---
title: 面试侃集合 | LinkedBlockingQueue篇
icon: page
order: 3
author: Hydra
date: 2021-05-23
tag:
  - 队列
  - LinkedBlockingQueue
star: true
---



<!-- more -->

面试官：好了，聊完了`ArrayBlockingQueue`，我们接着说说`LinkedBlockingQueue`吧

Hydra：还真是不给人喘口气的机会，`LinkedBlockingQueue`是一个基于链表的阻塞队列，内部是由节点`Node`构成，每个被加入队列的元素都会被封装成下面的`Node`节点，并且节点中有指向下一个元素的指针：

```java
static class Node<E> {
    E item;
    Node<E> next;
    Node(E x) { item = x; }
}
```

`LinkedBlockingQueue`中的关键属性有下面这些：

```java
private final int capacity;//队列容量
private final AtomicInteger count = new AtomicInteger();//队列中元素数量
transient Node<E> head;//头节点
private transient Node<E> last;//尾节点
//出队锁
private final ReentrantLock takeLock = new ReentrantLock();
//出队的等待条件对象
private final Condition notEmpty = takeLock.newCondition();
//入队锁
private final ReentrantLock putLock = new ReentrantLock();
//入队的等待条件对象
private final Condition notFull = putLock.newCondition();
```

构造函数分为指定队列长度和不指定队列长度两种，不指定时队列最大长度是`int`的最大值。当然了，你要是真存这么多的元素，很有可能会引起内存溢出：

```java
public LinkedBlockingQueue() {
    this(Integer.MAX_VALUE);
}
public LinkedBlockingQueue(int capacity) {
    if (capacity <= 0) throw new IllegalArgumentException();
    this.capacity = capacity;
    last = head = new Node<E>(null);
}	
```

还有另一种在初始化时就可以将集合作为参数传入的构造方法，实现非常好理解，只是循环调用了后面会讲到的`enqueue`入队方法，这里暂且略过。

在`LinkedBlockingQueue`中，队列的头节点`head`是不存元素的，它的`item`是`null`，`next`指向的元素才是真正的第一个元素，它也有两个用于阻塞等待的`Condition`条件对象。与之前的`ArrayBlockingQueue`不同，这里出队和入队使用了不同的锁`takeLock`和`putLock`。队列的结构是这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c12911d7f8f4cea8447df231ae321cc~tplv-k3u1fbpfcp-zoom-1.image)

面试官：为什么要使用两把锁，之前`ArrayBlockingQueue`使用一把锁，不是也可以保证线程的安全么？

Hydra：使用两把锁，可以保证元素的插入和删除并不互斥，从而能够同时进行，达到提高吞吐量的的效果

面试官：嗯，那还是老规矩，先说插入方法是怎么实现的吧

Hydra：这次就不提父类`AbstractQueue`的`add`方法了，反正它调用的也是子类的插入方法`offer`，我们就直接来看`offer`方法的源码：

```java
public boolean offer(E e) {
    if (e == null) throw new NullPointerException();
    final AtomicInteger count = this.count;//队列中元素个数
    if (count.get() == capacity)//已满
        return false;
    int c = -1;
    Node<E> node = new Node<E>(e);
    final ReentrantLock putLock = this.putLock;
    putLock.lock();
    try {
        //并发情况，再次判断队列是否已满
        if (count.get() < capacity) {
            enqueue(node);
            //注意这里获取的是未添加元素前的对列长度
            c = count.getAndIncrement();
            if (c + 1 < capacity)//未满
                notFull.signal();
        }
    } finally {
        putLock.unlock();
    }
    if (c == 0)
        signalNotEmpty();
    return c >= 0;
}
```

`offer`方法中，首先判断队列是否已满，未满情况下将元素封装成`Node`对象，尝试获取插入锁，在获取锁后会再进行一次队列已满判断，如果已满则直接释放锁。在持有锁且队列未满的情况下，调用`enqueue`入队方法。

`enqueue`方法的实现也非常的简单，将当前尾节点的`next`指针指向新节点，再把`last`指向新节点：

```java
private void enqueue(Node<E> node) {
    last = last.next = node;
}
```

画一张图，方便你理解：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6025326b200b4de88093553383c315ec~tplv-k3u1fbpfcp-zoom-1.image)

在完成入队后，判断队列是否已满，如果未满则调用`notFull.signal()`，唤醒等待将元素插入队列的线程。

面试官：我记得在`ArrayBlockingQueue`里插入元素后，是调用的`notEmpty.signal()`，怎么这里还不一样了？

Hydra：说到这，就不得不再提一下使用两把锁来分别控制插入和获取元素的好处了。在`ArrayBlockingQueue`中，使用了同一把锁对入队和出队进行控制，那么如果在插入元素后再唤醒插入线程，那么很有可能等待获取元素的线程就一直得不到唤醒，造成等待时间过长。

而在`LinkedBlockingQueue`中，分别使用了入队锁`putLock`和出队锁`takeLock`，插入线程和获取线程是不会互斥的。所以插入线程可以在这里不断的唤醒其他的插入线程，而无需担心是否会使获取线程等待时间过长，从而在一定程度上提高了吞吐量。当然了，因为`offer`方法是非阻塞的，并不会挂起阻塞线程，所以这里唤醒的是阻塞插入的`put`方法的线程。

面试官：那接着往下看，为什么要在`c`等于0的情况下才去唤醒`notEmpty`中的等待获取元素的线程？

Hydra：其实获取元素的方法和上面插入元素的方法是一个模式的，只要有一个获取线程在执行方法，那么就会不断的通过`notEmpty.signal()`唤醒其他的获取线程。只有当`c`等于0时，才证明之前队列中已经没有元素，这时候获取线程才可能会被阻塞，在这个时候才需要被唤醒。上面的这些可以用一张图来说明：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2cfce8355fda4ba2810fbb1ca304e111~tplv-k3u1fbpfcp-zoom-1.image)


由于我们之前说过，队列中的`head`节点可以认为是不存储数据的标志性节点，所以可以简单的认为出队时直接取出第二个节点，当然这个过程不是非常的严谨，我会在后面讲解出队的过程中再进行补充说明。 

面试官：那么阻塞方法`put`和它有什么区别？

Hydra：`put`和`offer`方法整体思路一致，不同的是加锁是使用的是可被中断的方式，并且当队列中元素已满时，将线程加入`notFull`等待队列中进行等待，代码中体现在：

```java
while (count.get() == capacity) {
    notFull.await();
}
```

这个过程体现在上面那张图的`notFull`等待队列中的元素上，就不重复说明了。另外，和`put`方法比较类似的，还有一个携带等待时间参数的`offer`方法，可以进行有限时间内的阻塞添加，当超时后放弃插入元素，我们只看和`offer`方法不同部分的代码：

```java
public boolean offer(E e, long timeout, TimeUnit unit){
    ...
    long nanos = unit.toNanos(timeout);//转换为纳秒
    ...
    while (count.get() == capacity) {
        if (nanos <= 0)
            return false;
        nanos = notFull.awaitNanos(nanos);
    }
    enqueue(new Node<E>(e));    
    ...
}
```

`awaitNanos`方法在`await`方法的基础上，增加了超时跳出的机制，会在循环中计算是否到达预设的超时时间。如果在到达超时时间前被唤醒，那么会返回超时时间减去已经消耗的时间。无论是被其他线程唤醒返回，还是到达指定的超时时间返回，只要方法返回值小于等于0，那么就认为它已经超时，最终直接返回`false`结束。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d32935997ad04c0faede60bd93dcbfc8~tplv-k3u1fbpfcp-zoom-1.image)

面试官：费这么大顿功夫才把插入讲明白，我先喝口水，你接着说获取元素方法

Hydra：……那先看非阻塞的`poll`方法

```java
public E poll() {
    final AtomicInteger count = this.count;
    if (count.get() == 0)//队列为空
        return null;
    E x = null;
    int c = -1;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        if (count.get() > 0) {//队列非空
            x = dequeue();
            //出队前队列长队
            c = count.getAndDecrement();
            if (c > 1)
                notEmpty.signal();
        }
    } finally {
        takeLock.unlock();
    }
    if (c == capacity)
        signalNotFull();
    return x;
}
```

出队的逻辑和入队的非常相似，当队列非空时就执行`dequeue`进行出队操作，完成出队后如果队列仍然非空，那么唤醒等待队列中挂起的获取元素的线程。并且当出队前的元素数量等于队列长度时，在出队后唤醒等待队列上的添加线程。

出队方法`dequeue`的源码如下：

```java
private E dequeue() {
    Node<E> h = head;
    Node<E> first = h.next;
    h.next = h; // help GC
    head = first;
    E x = first.item;
    first.item = null;
    return x;
}
```

之前提到过，头节点`head`并不存储数据，它的下一个节点才是真正意义上的第一个节点。在出队操作中，先得到头节点的下一个节点`first`节点，将当前头节点的`next`指针指向自己，代码中有一个简单的注释是`help gc`，个人理解这里是为了降低`gc`中的引用计数，方便它更早被回收。之后再将新的头节点指向`first`，并返回清空为`null`前的内容。使用图来表示是这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5c9158eeae7f47789e2947b02e4fa39f~tplv-k3u1fbpfcp-zoom-1.image)

面试官：（看看手表）`take`方法的整体逻辑也差不多，能简单概括一下吗

Hydra：阻塞方法`take`方法和`poll`的思路基本一致，是一个可以被中断的阻塞获取方法，在队列为空时，会挂起当前线程，将它添加到条件对象`notEmpty`的等待队列中，等待其他线程唤醒。

面试官：再给你一句话的时间，总结一下它和`ArrayBlockingQueue`的异同，我要下班回家了

Hydra：好吧，我总结一下，有下面几点：

- 队列长度不同，`ArrayBlockingQueue`创建时需指定长度并且不可修改，而`LinkedBlockingQueue`可以指定也可以不指定长度
- 存储方式不同，`ArrayBlockingQueue`使用数组，而`LinkedBlockingQueue`使用`Node`节点的链表
- `ArrayBlockingQueue`使用一把锁来控制元素的插入和移除，而`LinkedBlockingQueue`将入队锁和出队锁分离，提高了并发性能
- `ArrayBlockingQueue`采用数组存储元素，因此在插入和移除过程中不需要生成额外对象，`LinkedBlockingQueue`会生成新的`Node`节点，对`gc`会有影响

面试官：明天上午9点，老地方，我们再聊聊别的

Hydra：……