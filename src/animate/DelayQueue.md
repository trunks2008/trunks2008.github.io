---
title: 面试侃集合 | DelayQueue篇
icon: page
order: 7
author: Hydra
date: 2021-06-28
tag:
  - 队列
  - DelayQueue
star: true
---



<!-- more -->

面试官：好久不见啊，上次我们聊完了`PriorityBlockingQueue`，今天我们再来聊聊和它相关的`DelayQueue`吧。

Hydra：就知道你前面肯定给我挖了坑，`DelayQueue`也是一个无界阻塞队列，但是和之前我们聊的其他队列不同，不是所有类型的元素都能够放进去，只有实现了`Delayed`接口的对象才能放进队列。`Delayed`对象具有一个过期时间，只有在到达这个到期时间后才能从队列中取出。

面试官：有点意思，那么它有什么使用场景呢？

Hydra：不得不说，由于`DelayQueue`的精妙设计，使用场景还是蛮多的。例如在电商系统中，如果有一笔订单在下单30分钟内没有完成支付，那么就需要自动取消这笔订单。还有，如果我们缓存了一些数据，并希望这些缓存在一定时间后失效的话，也可以使用延迟队列将它从缓存中删除。

以电商系统为例，可以简单看一下这个流程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f39b3856fa2645b8b4253b9b7280c324~tplv-k3u1fbpfcp-zoom-1.image)

面试官：看起来和任务调度有点类似啊，它们之间有什么区别吗？

Hydra：任务调度更多的偏向于定时的特性，是在指定的**时间点**或**时间间隔**执行特定的任务，而延迟队列更多偏向于在指定的延迟时间后执行任务。相对任务调度来说，上面举的例子中的延迟队列场景都具有高频率的特性，使用定时任务来实现它们的话会显得有些过于笨重了。

面试官：好了，你也白话了半天了，能动手就别吵吵，还是先给我写个例子吧。

Hydra：好嘞，前面说过存入队列的元素要实现`Delayed`接口，所以我们先定义这么一个类：

```java
public class Task implements Delayed {
    private String name;
    private long delay,expire;
    public Task(String name, long delay) {
        this.name = name;
        this.delay = delay;
        this.expire=System.currentTimeMillis()+delay;
    }

    @Override
    public long getDelay(TimeUnit unit) {
        return unit.convert(this.expire - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }
    @Override
    public int compareTo(Delayed o) {
        return (int)(this.getDelay(TimeUnit.MILLISECONDS) - o.getDelay(TimeUnit.MILLISECONDS));
    }

}
```

实现了`Delayed`接口的类必须要实现下面的两个方法：

- `getDelay`方法用于计算对象的剩余延迟时间，判断对象是否到期，计算方法一般使用过期时间减当前时间。如果是0或负数，表示延迟时间已经用完，否则说明还没有到期

- `compareTo`方法用于延迟队列的内部排序比较，这里使用当前对象的延迟时间减去被比较对象的延迟时间

在完成队列中元素的定义后，向队列中加入5个不同延迟时间的对象，并等待从队列中取出：

```java
public void delay() throws InterruptedException {
    DelayQueue<Task> queue=new DelayQueue<>();
    queue.offer(new Task("task1",5000));
    queue.offer(new Task("task2",1000));
    queue.offer(new Task("task3",6000));
    queue.offer(new Task("task4",100));
    queue.offer(new Task("task5",3000));

    while(true){
        Task task = queue.take();
        System.out.println(task);
    }
}
```

运行结果如下，可以看到按照延迟时间从短到长的顺序，元素被依次从队列中取出。

```properties
Task{name='task4', delay=100}
Task{name='task2', delay=1000}
Task{name='task5', delay=3000}
Task{name='task1', delay=5000}
Task{name='task3', delay=6000}
```

面试官：看起来应用还是挺简单的，今天也不能这么草草了事吧，还是说说原理吧。

Hydra：开始的时候你自己不都说了吗，今天咱们聊的`DelayQueue`和前几天聊过的`PriorityBlockingQueue`多少有点关系。`DelayQueue`的底层是`PriorityQueue`，而`PriorityBlockingQueue`和它的差别也没有多少，只是在`PriorityQueue`的基础上加上锁和条件等待，入队和出队用的都是二叉堆的那一套逻辑。底层使用的有这些：

```java
private final transient ReentrantLock lock = new ReentrantLock();
private final PriorityQueue<E> q = new PriorityQueue<E>();
private Thread leader = null;
private final Condition available = lock.newCondition();
```

面试官：你这样也有点太糊弄我了吧，这就把我敷衍过去了？

Hydra：还没完呢，还是先看入队的`offer`方法，它的源码如下：

```java
public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        q.offer(e);
        if (q.peek() == e) {
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        lock.unlock();
    }
}
```

`DelayQueue`每次向优先级队列`PriorityQueue`中添加元素时，会以元素的剩余延迟时间`delay`作为排序的因素，来实现使最先过期的元素排在队首，以此达到在之后从队列中取出的元素都是先取出最先到达过期的元素。

二叉堆的构造过程我们上次讲过了，就不再重复了。向队列中添加完5个元素后，二叉堆和队列中的结构是这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e1412f3656d642bdb84275fdc4e6a8cd~tplv-k3u1fbpfcp-zoom-1.image)

当每个元素在按照二叉堆的顺序插入队列后，会查看堆顶元素是否刚插入的元素，如果是的话那么设置`leader`线程为空，并唤醒在`available`上阻塞的线程。

这里先简单的介绍一下`leader`线程的作用，`leader`是等待获取元素的线程，它的作用主要是用于减少不必要的等待，具体的使用在后面介绍`take`方法的时候我们细说。

面试官：也别一会了，趁热打铁直接讲队列的出队方法吧。

Hydra：这还真没法着急，在看阻塞方法`take`前还得先看看非阻塞的`poll`方法是如何实现的：

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        E first = q.peek();
        if (first == null || first.getDelay(NANOSECONDS) > 0)
            return null;
        else
            return q.poll();
    } finally {
        lock.unlock();
    }
}
```

代码非常短，理解起来非常简单，在加锁后首先检查堆顶元素，如果堆顶元素为空或没有到期，那么直接返回空，否则返回堆顶元素，然后解锁。

面试官：好了，铺垫完了吧，该讲阻塞方法的过程了吧？

Hydra：阻塞的`take`方法理解起来会比上面稍微困难一点，我们还是直接看它的源码：

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            E first = q.peek();
            if (first == null)
                available.await();
            else {
                long delay = first.getDelay(NANOSECONDS);
                if (delay <= 0)
                    return q.poll();
                first = null; // don't retain ref while waiting
                if (leader != null)
                    available.await();
                else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;
                    try {
                        available.awaitNanos(delay);
                    } finally {
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            available.signal();
        lock.unlock();
    }
}
```

阻塞过程中分支条件比较复杂，我们一个一个看：

- 首先获取堆顶元素，如果为空，那么说明队列中还没有元素，让当前线程在`available`上进行阻塞等待
- 如果堆顶元素不为空，那么查看它的过期时间，如果已到期，那么直接弹出堆顶元素
- 如果堆顶元素还没有到期，那么查看`leader`线程是否为空，如果`leader`线程不为空的话，表示已经有其他线程在等待获取队列的元素，直接阻塞当前线程。
- 如果`leader`为空，那么把当前线程赋值给它，并调用`awaitNanos`方法，在阻塞`delay`时间后自动醒来。唤醒后，如果`leader`还是当前线程那么把它置为空，重新进入循环，再次判断堆顶元素是否到期。

当有队列中的元素完成出队后，如果`leader`线程为空，并且堆中还有元素，就唤醒阻塞在`available`上的其他线程，并释放持有的锁。

面试官：我注意到一个问题，在上面的代码中，为什么要设置`first = null`呢？

Hydra：假设有多个线程在执行`take`方法，当第一个线程进入时，堆顶元素还没有到期，那么会将`leader`指向自己，然后阻塞自己一段时间。如果在这期间有其他线程到达，会因为`leader`不为空阻塞自己。

当第一个线程阻塞结束后，如果将堆顶元素弹出成功，那么`first`指向的元素应该被`gc`回收掉。但是如果还被其他线程持有的话，它就不会被回收掉，所以将`first`置为空可以帮助完成垃圾回收。

面试官：我突然有一个发散性的疑问，定时任务线程池`ScheduledThreadPoolExecutor`，底层使用的也是`DelayQueue`吗？

Hydra：问题很不错，但很遗憾并不是，`ScheduledThreadPoolExecutor`在类中自己定义了一个`DelayedWorkQueue`内部类，并没有直接使用`DelayQueue`。不过如果你看一下源码，就会看到它们实现的逻辑基本一致，同样是基于二叉堆的上浮、下沉、扩容，也同样基于`leader`、锁、条件等待等操作，只不过自己用数组又实现了一遍而已。说白了，看看两个类的作者，都是`Doug Lea`大神，所以差异根本没有多大。

面试官：好了，今天先到这吧，能最后再总结一下吗？

Hydra：`DelayQueue`整体理解起来也没有什么困难的点，难的地方在前面聊优先级队列的时候基本已经扫清了，新加的东西也就是一个对于`leader`线程的操作，使用了`leader`线程来减少不必要的线程等待时间。

面试官：今天的面试有点短啊，总是有点意犹未尽的感觉，看来下次得给你加点料了。

Hydra：……