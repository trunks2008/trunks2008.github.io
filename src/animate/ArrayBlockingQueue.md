---
title: 面试侃集合 | ArrayBlockingQueue篇
icon: page
order: 2
author: Hydra
date: 2021-05-17
tag:
  - 队列
  - ArrayBlockingQueue
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

面试官：平常在工作中你都用过什么什么集合？

Hydra：用过 ArrayList、HashMap，呃…没有了

面试官：好的，回家等通知吧…

> 不知道大家在面试中是否也有过这样的经历，工作中仅仅用过的那么几种简单的集合，被问到时就会感觉捉襟见肘。在面试中，如果能够讲清一些具有特殊的使用场景的集合工具类，一定能秀的面试官头皮发麻。于是Hydra苦学半月，再次来和面试官对线

面试官：又来了老弟，让我看看你这半个月学了些什么

Hydra：那就先从`ArrayBlockingQueue` 中开始聊吧，它是一个具有**线程安全性**和**阻塞性**的有界队列

面试官：好啊，那先给我解释一下它的线程安全性

Hydra：`ArrayBlockingQueue`的线程安全是通过底层的`ReentrantLock`保证的，因此在元素出入队列操作时，无需额外加锁。写一段简单的代码举个例子，从具体的使用来说明它的线程安全吧

```java
ArrayBlockingQueue<Integer> queue=new ArrayBlockingQueue(7,
        true, new ArrayList<>(Arrays.asList(new Integer[]{1,2,3,4,5,6,7})));

@AllArgsConstructor
class Task implements Runnable{
    String threadName;
    @Override
    public void run() {
        while(true) {
            try {
                System.out.println(threadName+" take: "+queue.take());
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}

private void queueTest(){
    new Thread(new Task("Thread 1")).start();
    new Thread(new Task("Thread 2")).start();
}
```

在代码中创建队列时就往里放入了7个元素，然后创建两个线程各自从队列中取出元素。对队列的操作也非常简单，只用到了操作队列中出队方法`take`，运行结果如下：

```shell
Thread 1 take: 1
Thread 2 take: 2
Thread 1 take: 3
Thread 2 take: 4
Thread 1 take: 5
Thread 2 take: 6
Thread 1 take: 7
```

可以看到在公平模式下，两个线程交替对队列中的元素执行出队操作，并没有出现重复取出的情况，即保证了多个线程对资源竞争的互斥访问。它的过程如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5755eca6c5964f078a313485cf90d3e1~tplv-k3u1fbpfcp-zoom-1.image)

面试官：那它的阻塞性呢？

Hydra：好的，还是写段代码通过例子来说明

```java
private static void queueTest() throws InterruptedException {
    ArrayBlockingQueue<Integer> queue=new ArrayBlockingQueue<>(3);
    int size=7;
    Thread putThread=new Thread(()->{
        for (int i = 0; i <size ; i++) {
            try {
                queue.put(i);
                System.out.println("PutThread put: "+i+" - Size:"+queue.size());
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    });
    Thread takeThread = new Thread(() -> {
        for (int i = 0; i < size+1 ; i++) {
            try {
                Thread.sleep(3000);
                System.out.println("TakeThread take: "+queue.take());
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    });

    putThread.start();
    Thread.sleep(1000);
    takeThread.start();
}
```

和第一个例子中的代码不同，这次我们创建队列时只指定长度，并不在初始化时就往队列中放入元素。接下来创建两个线程，一个线程充当生产者，生产产品放入到队列中，另一个线程充当消费者，消费队列中的产品。需要注意生产和消费的速度是不同的，生产者每一秒生产一个，而消费者每三秒才消费一个。执行上面的代码，运行结果如下：

```properties
PutThread put: 0 - Size:1
PutThread put: 1 - Size:2
PutThread put: 2 - Size:3
TakeThread take: 0
PutThread put: 3 - Size:3
TakeThread take: 1
PutThread put: 4 - Size:3
TakeThread take: 2
PutThread put: 5 - Size:3
TakeThread take: 3
PutThread put: 6 - Size:3
TakeThread take: 4
TakeThread take: 5
TakeThread take: 6
```

来给你画个比较直观的图吧：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df27675d5f6d497fa34b3d2f53c43819~tplv-k3u1fbpfcp-zoom-1.image)

分析运行结果，能够在两个方面体现出队列的阻塞性：

- 入队阻塞：当队列中的元素个数等于队列长度时，会阻塞向队列中放入元素的操作，当有出队操作取走队列中元素，队列出现空缺位置后，才会再进行入队
- 出队阻塞：当队列中的元素为空时，执行出队操作的线程将被阻塞，直到队列不为空时才会再次执行出队操作。在上面的代码的出队线程中，我们故意将出队的次数设为了队列中元素数量加一，因此这个线程最后会被一直阻塞，程序将一直执行不会结束

面试官：你只会用`put`和`take`方法吗，能不能讲讲其他的方法？

Hydra：方法太多了，简单概括一下插入和移除相关的操作吧

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/78343a81f8cc48538b38c5f9153203c1~tplv-k3u1fbpfcp-zoom-1.image)

面试官：方法记得还挺清楚，看样子是个合格的 API caller。下面说说原理吧，先讲一下`ArrayBlockingQueue` 的结构

Hydra：在`ArrayBlockingQueue` 中有下面四个比较重要的属性

```java
final Object[] items;
final ReentrantLock lock;
private final Condition notEmpty;
private final Condition notFull;

public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0) throw new IllegalArgumentException();
    this.items = new Object[capacity];
    lock = new ReentrantLock(fair);
    notEmpty = lock.newCondition();
    notFull =  lock.newCondition();
}
```

在构造函数中对它们进行了初始化：

- `Object[] items`：队列的底层由数组组成，并且数组的长度在初始化就已经固定，之后无法改变
- `ReentrantLock lock`：用对控制队列操作的独占锁，在操作队列的元素前需要获取锁，保护竞争资源
- `Condition notEmpty`：条件对象，如果有线程从队列中获取元素时队列为空，就会在此进行等待，直到其他线程向队列后插入元素才会被唤醒
- `Condition notFull`：如果有线程试图向队列中插入元素，且此时队列为满时，就会在这进行等待，直到其他线程取出队列中的元素才会被唤醒

`Condition`是一个接口，代码中的`notFull`和`notEmpty`实例化的是AQS的内部类`ConditionObject`，它的内部是由AQS中的`Node`组成的等待链，`ConditionObject`中有一个头节点`firstWaiter`和尾节点`lastWaiter`，并且每一个`Node`都有指向相邻节点的指针。简单的来说，它的结构是下面这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a421085e12ad44bd99b366c6ddb176fa~tplv-k3u1fbpfcp-zoom-1.image)

至于它的作用先卖个关子，放在后面讲。除此之外，还有两个`int`类型的属性`takeIndex`和`putIndex`，表示获取元素的索引位置和插入元素的索引位置。假设一个长度为5的队列中已经有了3个元素，那么它的结构是这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/553f1d8cfb2844bebdbfc89ac3130be0~tplv-k3u1fbpfcp-zoom-1.image)

面试官：说一下队列的插入操作吧

Hydra：好的，那我们先说`add`和`offer`方法，在执行`add`方法时，调用了其父类`AbstractQueue`中的`add`方法。`add`方法则调用了`offer`方法，如果添加成功返回`true`，添加失败时抛出异常，看一下源码：

```java
public boolean add(E e) {
    if (offer(e))
        return true;
    else
        throw new IllegalStateException("Queue full");
}

public boolean offer(E e) {
    checkNotNull(e);//检查元素非空
    final ReentrantLock lock = this.lock; //获取锁并加锁
    lock.lock();
    try {
        if (count == items.length)//队列已满
            return false;
        else {
            enqueue(e);//入队
            return true;
        }
    } finally {
        lock.unlock();
    }
}
```

实际将元素加入队列的核心方法`enqueue`：

```java
private void enqueue(E x) {
    final Object[] items = this.items;
    items[putIndex] = x; 
    if (++putIndex == items.length)
        putIndex = 0;
    count++;
    notEmpty.signal();
}

```

在`enqueue`中，首先将元素放入数组中下标为`putIndex`的位置，然后对`putIndex`自增，并判断是否已处于队列中最后一个位置，如果`putIndex`索引位置等于数组的长度时，那么将`putIndex`置为0，即下一次在元素入队时，从队列头开始放置。

举个例子，假设有一个长度为5的队列，现在已经有4个元素，我们进行下面一系列的操作，来看一下索引下标的变化：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1c31a44ac1c84b318541d81ce3779449~tplv-k3u1fbpfcp-zoom-1.image)

上面这个例子提前用到了队列中元素被移除时`takeIndex`会自增的知识点，通过这个例子中索引的变化，可以看出`ArrayBlockingQueue`就是一个循环队列，`takeIndex`就相当于队列的头指针，而`putIndex`相当于队列的尾指针的下一个位置索引。并且这里不需要担心在队列已满时还会继续向队列中添加元素，因为在`offer`方法中会首先判断队列是否已满，只有在队列不满时才会执行`enqueue`方法。

面试官：这个过程我明白了，那`enqueue`方法里最后的`notEmpty.signal()`是什么意思？

Hydra：这是一个唤醒操作，等后面讲完它的挂起后再说。我还是先把插入操作中的`put`方讲完吧，看一下它的源码：

```java
public void put(E e) throws InterruptedException {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == items.length)
            notFull.await();
        enqueue(e);
    } finally {
        lock.unlock();
    }
}
```

`put`方法是一个阻塞方法，当队列中元素未满时，会直接调用`enqueue`方法将元素加入队列中。如果队列已满，就会调用`notFull.await()`方法将挂起当前线程，直到队列不满时才会被唤醒，继续执行插入操作。

当队列已满，再执行`put`操作时，就会执行下面的流程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d4c7b34316ab4283bad78da883c0081b~tplv-k3u1fbpfcp-zoom-1.image)

这里提前剧透一下，当队列中有元素被移除，在调用`dequeue`方法中的`notFull.signal()`时，会唤醒等待队列中的线程，并把对应的元素添加到队列中，流程如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/64b585a56bd44fff9c2a7d7fb40a2e42~tplv-k3u1fbpfcp-zoom-1.image)

做一个总结，在插入元素的几个方法中，`add`、`offer`以及带有超时的`offer`方法都是非阻塞的，会立即返回或超时后立即返回，而`put`方法是阻塞的，只有当队列不满添加成功后才会被返回。

面试官：讲的不错，讲完插入操作了再讲讲移除操作吧

Hydra：还是老规矩，先说非阻塞的方法`remove`和`poll`，父类的`remove`方法还是会调用子类的`poll`方法，不同的是`remove`方法在队列为空时抛出异常，而`poll`会直接返回`null`。这两个方法的核心还是调用的`dequeue`方法，它的源码如下：

```java
private E dequeue() {
    final Object[] items = this.items;
    E x = (E) items[takeIndex];
    items[takeIndex] = null;
    if (++takeIndex == items.length)
        takeIndex = 0;
    count--;
    if (itrs != null)
        //更新迭代器中的元素
        itrs.elementDequeued();
    notFull.signal();
    return x;
}
```

在`dequeue`中，在获取到数组下标为`takeIndex`的元素，并将该位置置为`null`。将`takeIndex`自增后判断是否与数组长度相等，如果相等还是按之前循环队列的理论，将它的索引置为0，并将队列的中的计数减1。

有一个队列初始化时有5个元素，我们对齐分别进行5次的出队操作，查看索引下标的变化情况：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/008330fa529b46839212a95b176ef63d~tplv-k3u1fbpfcp-zoom-1.image)

然后我们还是结合`take`方法来说明线程的挂起和唤醒的操作，与`put`方法相对，`take`用于阻塞获取元素，来看一下它的源码：

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0)
            notEmpty.await();
        return dequeue();
    } finally {
        lock.unlock();
    }
}
```

`take`是一个可以被中断的阻塞获取元素的方法，首先判断队列是否为空，如果队列不为空那么就调用`dequeue`方法移除元素，如果队列为空时就调用`notEmpty.await()`就将当前线程挂起，直到有其他的线程调用了`enqueue`方法，才会唤醒等待队列中被挂起的线程。可以参考下面的图来理解：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/36577eb9e023481e9b58410e736736c0~tplv-k3u1fbpfcp-zoom-1.image)

当有其他线程向队列中插入元素后：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c14136463f174475a84ab5cb65e9e418~tplv-k3u1fbpfcp-zoom-1.image)

入队的`enqueue`方法会调用`notEmpty.signal()`，唤醒等待队列中`firstWaiter`指向的节中的线程，并且该线程会调用`dequeue`完成元素的出队操作。到这移除的操作就也分析完了，至于开头为什么说`ArrayBlockingQueue`是线程安全的，看到每个方法前都通过全局单例的`lock`加锁，相信你也应该明白了

面试官：好了，`ArrayBlockingQueue`我懂了，我先去吃个饭，回来咱们再聊聊别的集合

Hydra：……

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24a4d179c3fc40b5a1276b29ca00046d~tplv-k3u1fbpfcp-zoom-1.image)


