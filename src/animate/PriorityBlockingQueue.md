---
title: 面试侃集合 | PriorityBlockingQueue篇
icon: page
order: 6
author: Hydra
date: 2021-06-15
tag:
  - 队列
  - PriorityBlockingQueue
star: true
---



<!-- more -->

面试官：来了啊小伙子，以前经常有小菜鸟被我虐个两三轮就不敢来了，看你忍耐力还不错，以后应该挺能加班的样子。

Hydra：那可是，我卷起来真的是连我自己都害怕啊！

面试官：那咱们今天就继续死磕队列，聊聊`PriorityBlockingQueue`吧。

Hydra：没问题啊，`PriorityBlockingQueue`是一个支持优先级的无界阻塞队列，之前介绍的队列大多是`FIFO`先进先出或`LIFO`后进先出的，`PriorityBlockingQueue`不同，可以按照自然排序或自定义排序的顺序在队列中对元素进行排序。

我还是先写一个例子吧，使用`offer`方法向队列中添加5个随机数，然后使用`poll`方法从队列中依次取出：

```java
PriorityBlockingQueue<Integer> queue=new PriorityBlockingQueue<Integer>(5);

Random random = new Random();
System.out.println("add:");
for (int i = 0; i < 5; i++) {
    int j = random.nextInt(100);
    System.out.print(j+"  ");
    queue.offer(j);
}

System.out.println("\r\npoll:");
for (int i = 0; i < 5; i++) {
    System.out.print(queue.poll()+"  ");
}
```

查看运行结果，可以看到输出顺序与插入顺序是不同的，默认情况下最终会按照自然排序的顺序进行输出：

```properties
add:
68  34  40  31  44  
poll:
31  34  40  44  68 
```

`PriorityBlockingQueue`队列就像下面这个神奇的容器，不管你按照什么顺序往里塞数据，在取出的时候一定是按照排序完成后的顺序出队的。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0488565ee11c40d98d0ed2fd12d73a2c~tplv-k3u1fbpfcp-zoom-1.image)

面试官：怎么感觉这功能有点鸡肋啊，很多情况下我不想用自然排序怎么办？

Hydra：一看你就没仔细听我前面讲的，除了自然排序外，也可以自定义排序顺序。如果我们想改变排序算法，也可以在构造器中传入一个`Comparator`对象，像下面这么一改就可以变成降序排序了：

```java
PriorityBlockingQueue queue=new PriorityBlockingQueue<Integer>(10, new Comparator<Integer>() {
    @Override
    public int compare(Integer o1, Integer o2) {
        return o2-o1;
    }
});
```

面试官：我就随口问一句你还真以为我不知道啊，说一下底层是怎么实现的吧？

Hydra：在讲底层的原理之前，就不得不先提一下**二叉堆**的数据结构了。二叉堆是一种特殊的堆，它的结构和完全二叉树非常类似。如果父节点的值总小于子节点的值，那么它就是一个最小二叉堆，反之则是最大二叉堆，并且每个节点的左子树和右子树也是一个二叉堆。

以一个最小二叉堆为例：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2ec6c1b3e105486d9d5c47e092ad8ee3~tplv-k3u1fbpfcp-zoom-1.image)

这个最小二叉堆保存在数组中的顺序是这样的：

```properties
[1,2,3,4,5,6,7,8,9]
```

根据它的特性，可以轻松的计算出一个节点的父节点或子节点在数组中对应的位置。假设一个元素在数组中的下标是`t`，那么父节点、左右子节点的下标计算公式如下：

```properties
parent(t) = (t - 1) >>> 1 
left(t) = t << 1 + 1
right(t) = t << 1 + 2
```

以上面的二叉堆中的元素6为例，它在数组中的下标是5，可以计算出它的父节点下标为2，对应元素为3：

```properties
parent(5) = 100 >>> 1 = 2
```

如果要计算元素4的左右子节点的话，它的下标是3，计算出的子节点坐标分别为7,8，对应的元素为8,9：

```properties
left(3) = 11 << 1 + 1 = 7
right(3) = 11 << 1 + 2 = 8
```

在上面计算元素的数组位置过程中使用了左移右移操作，是不是感觉非常酷炫？

面试官：行了别贫了，铺垫了半点，赶紧说队列的底层原理。

Hydra：别急，下面就讲了，在`PriorityBlockingQueue`中，关键的属性有下面这些：

```java
private transient Object[] queue;
private transient int size;
private transient Comparator<? super E> comparator;
private final ReentrantLock lock;
private final Condition notEmpty;
```

前面我们也说了，二叉堆可以用数组的形式存储，所以队列的底层仍然是使用数组来存放元素的。在无参构造函数中，队列的初始容量是11，`comparator`为空，也就是使用元素自身的`compareTo`方法来进行比较排序。和`ArrayBlockingQueue`类似，底层通过`ReentrantLock`实现线程间的并发控制, 并使用`Condition`实现线程的等待及唤醒。

面试官：这么一看，属性和`ArrayBlockingQueue`还真是基本差不多啊，那结构就介绍到这吧，说重点，元素是怎么按照排序方法插入的？

Hydra：我们先对`offer`方法的执行流程进行分析，如果队列中元素未满，且在默认情况下`comparator`为空时，按照自然顺序排序，会执行`siftUpComparable`方法：

```java
private static <T> void siftUpComparable(int k, T x, Object[] array) {
    Comparable<? super T> key = (Comparable<? super T>) x;
    while (k > 0) {
        int parent = (k - 1) >>> 1;
        Object e = array[parent];
        if (key.compareTo((T) e) >= 0)
            break;
        array[k] = e;
        k = parent;
    }
    array[k] = key;
}
```

如果队列为空，那么元素直接入队，如果队列中已经有元素了，那么就需要判断插入的位置了。首先获取父节点的坐标，将自己的值和父节点进行比较，可以分为两种情况：

- 如果新节点的值比父节点大，那么说明当前父节点就是较小的元素，不需要进行调整，直接将元素添加到队尾
- 如果新节点的值比父节点小的话，那么就要进行**上浮**操作。先将父节点的值复制到子节点的位置，下一次将新节点的值与父节点的父节点进行比较。这一上浮过程会持续进行，直到新节点的值比父节点大，或新节点上浮成为根节点为止

还是以上面数据插入过程为例，来演示二叉树的构建过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b25e1f3136f148249553fc59599cd841~tplv-k3u1fbpfcp-zoom-1.image)

在将新元素添加到队列中后，队列中元素的计数加1，并且去唤醒阻塞在`notEmpty`上的等待线程。

面试官：那么如果不是自然排序的时候，逻辑会发生改变吗？

Hydra：如果`comparator`不为空的话，逻辑与上面的方法基本一致，唯一不同的是在进行比较时调用的是传入的自定义`comparator`的`compare`方法。

面试官：刚才你在讲`offer`方法的时候，强调了**队列中元素未满**这一个条件，开始的时候不是说`PriorityBlockingQueue`是一个无界队列么，那为什么还要加这一个条件？

Hydra：虽然说它是一个无界队列，但其实队列的长度上限是`Integer.MAX_VALUE - 8`，并且底层是使用的数组保存元素，在初始化数组的时候也会指定一个长度，如果超过这个长度的话，那么就需要进行扩容，执行`tryGrow`方法：

```java
private void tryGrow(Object[] array, int oldCap) {
    lock.unlock(); // 释放锁
    Object[] newArray = null;
    if (allocationSpinLock == 0 &&
        //cas 加锁
        UNSAFE.compareAndSwapInt(this, allocationSpinLockOffset,0, 1)) {
        try {
            //计算扩容后的容量
            int newCap = oldCap + ((oldCap < 64) ?
                                   (oldCap + 2) : // grow faster if small
                                   (oldCap >> 1));
            // 避免超出上限
            if (newCap - MAX_ARRAY_SIZE > 0) {    
                int minCap = oldCap + 1;
                if (minCap < 0 || minCap > MAX_ARRAY_SIZE)
                    throw new OutOfMemoryError();
                newCap = MAX_ARRAY_SIZE;
            }
            if (newCap > oldCap && queue == array)
                //申请新的数组
                newArray = new Object[newCap];
        } finally {
            //释放cas锁标志位
            allocationSpinLock = 0;
        }
    }
    //其他线程正在扩容，让出CPU
    if (newArray == null) // back off if another thread is allocating
        Thread.yield();
    //加独占式锁，拷贝原先队列中的数据
    lock.lock();
    if (newArray != null && queue == array) {
        queue = newArray;
        System.arraycopy(array, 0, newArray, 0, oldCap);
    }
}
```

先说锁的操作，在进行扩容前，会先释放独占式的`lock`，因为扩容操作需要一定的时间，如果在这段时间内还持有锁的话会降低队列的吞吐量。因此这里使用`cas`的方式保证扩容这一操作本身是排他性的，即只有一个线程来实现扩容。在完成新数组的申请后，会释放`cas`锁的标志位，并在拷贝队列中原有数据到新数组前，再次加独占式锁`lock`，保证线程间的数据安全。

至于扩容操作也很简单，假设当前数组长度为`n`，如果小于64的话那么数组长度扩为`2n+2`，如果大于64则扩为`1.5n`，并且扩容后的数组不能超过上面说的上限值。申请完成新的数组空间后，使用`native`方法实现数据的拷贝。

假设初始长度为5，当有新元素要入队时，就需要进行扩容，如图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2fa567c0982a4aed9c68066ac41f1341~tplv-k3u1fbpfcp-zoom-1.image)

面试官：ok，讲的还不赖，该说出队的方法了吧？

Hydra：嗯，有了前面的基础，出队过程理解起来也非常简单，还是以自然排序为例，看一下`dequeue`方法（省略了部分不重要的代码）：

```java
private E dequeue() {
    int n = size - 1;
    // ...
    Object[] array = queue;
    E result = (E) array[0];
    E x = (E) array[n];
    array[n] = null;
	// ...
    siftDownComparable(0, x, array, n);
	// ...
    size = n;
    return result;    
}
```

如果队列为空，`dequeue`方法会直接返回`null`，否则返回数组中的第一个元素。在将队尾元素保存后，清除队尾节点，然后调用`siftDownComparable`方法，调整二叉堆的结构，使其成为一个新的最小二叉堆：

```java
private static <T> void siftDownComparable(int k, T x, Object[] array,int n) {
    if (n > 0) {
        Comparable<? super T> key = (Comparable<? super T>)x;
        int half = n >>> 1;           // loop while a non-leaf
        while (k < half) {
            int child = (k << 1) + 1; // assume left child is least
            Object c = array[child];
            int right = child + 1;
            if (right < n &&
                ((Comparable<? super T>) c).compareTo((T) array[right]) > 0)
                c = array[child = right];
            if (key.compareTo((T) c) <= 0)
                break;
            array[k] = c;
            k = child;
        }
        array[k] = key;
    }
}
```

首先解释一下`half`的作用，它用来寻找队列的中间节点，所有**非叶子节点**的坐标都不会超过这个`half`值。分别以树中含有奇数个节点和偶数个节点为例：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c0d55dd4d7ac480cabbc75b607b3cfcc~tplv-k3u1fbpfcp-zoom-1.image)

```properties
[n=9]  1001 >>> 1 =100 =4
[n=8]  1000 >>> 1 =100 =4
```

可以看到，奇数和偶数的情况下计算出的`half`值都是4，即非叶子节点的下标不会超过4，对应上图中的元素为5。

面试官：计算二叉树最后非叶子节点坐标这点知识，大一学过数据结构的新生都知道，赶紧说正题！

Hydra：着什么急啊，前面我们也说了，在将堆顶元素取出后，堆顶位置的元素出现空缺，需要调整堆结构使二叉堆的结构特性保持不变。这时候比较简单的方法就是将尾结点直接填充到堆顶，然后从堆顶开始调整结构。

因此在代码中，每次执行堆顶节点的出队后，都将尾节点取出，然后从根节点开始向下比较，这一过程可以称为**下沉**。下沉过程从根节点开始，首先获取左右子节点的坐标，并取出存储的元素值较小的那个，和`key`进行比较：

- 如果`key`比左右节点都要小，那么说明找到了位置，比较结束，直接使用它替换父节点即可
- 否则的话，调整二叉堆结构，将较小的子节点上浮，使用它替换父节点。然后将用于比较的父节点坐标`k`下移调整为较小子节点，准备进行下一次的比较

别看我白话这么一大段，估计你还是不明白，给你画个图吧，以上面的队列执行一次`poll`方法为例：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a427b271a92f4a1ea09e31e507d57f37~tplv-k3u1fbpfcp-zoom-1.image)

后面的操作也是以此类推，分析到这出队操作也就结束了，`PriorityBlockingQueue`也没什么其他好讲的了。

面试官：我发现你现在开始偷懒了，前面的面试里你还分一下阻塞和非阻塞方法，现在不说一下这两种方式的区别就想蒙混过关了？

Hydra：嗨，在`PriorityBlockingQueue`里阻塞和非阻塞的区别其实并不大，首先因为它是一个无界的队列，因此添加元素的操作是不会被阻塞的，如果看一下源码，你就会发现其他的添加方法`add`、`put`也是直接调用的`offer`方法。

而取出元素操作会受限制于队列是否为空，因此可能会发生阻塞，阻塞方法`take`和非阻塞的`poll`会稍有不同，如果出现队列为空的情况，`poll`会直接返回`null`，而`take`会将线程在`notEmpty`上进行阻塞，等待队列中被添加元素后唤醒。

面试官：嗯，优先级队列我们也聊的差不多了，反正都聊了这么久的队列了，不介意我们把剩余的几个也说完吧？

Hydra：没问题啊，毕竟我能有什么选择呢？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2353c2540ded4082b261b8652aa1c3b8~tplv-k3u1fbpfcp-zoom-1.image)