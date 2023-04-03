---
title: 源码级深挖AQS队列同步器
icon: page
order: 7
author: Hydra
date: 2021-04-10
tag:
  - AQS
  - JUC
star: true
---



<!-- more -->

我们知道，在java中提供了两类锁的实现，一种是在jvm层级上实现的`synchrinized`隐式锁，另一类是jdk在代码层级实现的，juc包下的`Lock`显示锁，而提到`Lock`就不得不提一下它的核心**队列同步器**（`AQS`）了，它的全称是`AbstractQueuedSynchronizer`，是用来构建锁或者其他一些同步组件的基础，除了`ReentrantLock`、`ReentrantReadWriteLock`外，它还在`CountDownLatch`、`Semaphore`以及`ThreadPoolExecutor`中被使用，通过理解队列同步器的工作原理，对我们了解和使用这些工具类会有很大的帮助。

### 1、AQS 基础

为了便于理解AQS的概念，首先摘录部分`AbstractQueuedSynchronizer`的注释进行简要翻译：

> 它提供了一个框架，对于依赖先进先出等待队列的阻塞锁和同步器（例如信号量和事件），可以用它来实现。这个类的设计，对于大多数依赖于单个原子值来表示状态（state）的同步器，可以提供有力的基础。子类需要重写被protected修饰的方法，例如更改状态（state），定义在获取或释放对象时这些状态表示的含义。基于这些，类中的其他方法实现了队列和阻塞机制。在子类中可以维护其他的状态字段，但是只有使用getState，setState，compareAndSetState方法原子更新的状态值变量，才与同步有关。
>
> 子类被推荐定义为非public的内部类，用来实现封闭类的属性同步。同步器本身没有实现任何同步接口，它仅仅定义了一些方法，供具体的锁和同步组件中的public方法调用。
>
> 队列同步器支持独占模式和共享模式，当一个线程在独占模式下获取时，其他线程不能获取成功，在共享模式下多线程的获取可能成功。在不同模式下，等待的线程使用的是相同的先进先出队列。通常，实现子类只支持其中的一种模式，但是在ReadWriteLock中两者都可以发挥作用。只支持一种模式的子类在实现时不需要重写另一种模式中的方法。

阅读这些注释，可以知道`AbstractQueuedSynchronizer`是一个抽象类，它基于内部先进先出（`FIFO`）的双向队列、以及内置的一些`protected`方法来实现同步器，完成同步状态的管理，并且我们可以通过子类继承AQS抽象类的方式，在共享模式或独占模式下，实现自定义的同步组件。

通过上面的描述，可以看出AQS中的两大核心是**同步状态**和双向的**同步队列**，来看一下源码中是如何对它们进行定义的：

```java
public abstract class AbstractQueuedSynchronizer
    extends AbstractOwnableSynchronizer implements java.io.Serializable {
	static final class Node {
		volatile int waitStatus;
		volatile Node prev;
		volatile Node next;
		volatile Thread thread;
		//...
	}
	private transient volatile Node head;
	private transient volatile Node tail;
	private volatile int state;
	//...
}
```

下面针对这两个核心内容分别进行研究。

#### 同步队列

AQS内部静态类`Node`用于表示同步队列中的节点，变量表示的意义如下：

- `prev`：当前节点的前驱节点，如果当前节点是同步队列的头节点，那么`prev`为`null`
- `next`：当前节点的后继节点，如果当前节点是同步队列的尾节点，那么`next`为`null`
- `thread`：获取同步状态的线程
- `waitStatus`：等待状态，取值可为以下情况
  - `CANCELLED(1)`：表示当前节点对应的线程被取消，当线程等待超时或被中断时会被修改为此状态
  - `SIGNAL(-1)`：当前节点的后继节点的线程被阻塞，当前线程在释放同步状态或取消时，需要唤醒后继节点的线程
  - `CONDITION(-2)`：节点处于等待队列中，节点线程等待在`Condition`上，当其他线程调用`Condition`的`signal`方法后，会将节点从等待队列移到同步队列
  - `PROPAGATE(-3)`：表示下一次共享式同步状态获取能够被执行，即同步状态的获取可以向后继节点的后继进行无条件的传播
  - `0`：初始值，表示当前节点等待获取同步状态

每个节点的`prev`和`next`指针在加入队列的时候进行赋值，通过这些指针就形成了一个双向列表，另外AQS还保存了同步队列的头节点`head`和尾节点`tail`，通过这样的结构，就能够通过头节点或尾节点，找到队列中的任何一个节点。使用图来表示同步队列的结构如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99d4a1a49acb424a95ea83e8b4861b39~tplv-k3u1fbpfcp-zoom-1.image)

另外可以看到，在源码中为了保证可见性，同步器中的`head`、`tail`、`state`，以及节点中的`prev`，`next`属性都加了关键字`volatile`修饰。

#### 同步状态

AQS的另一核心同步状态，在代码中是使用`int`类型的变量`state`来表示的，通过原子操作修改同步状态的值，来实现对同步组件的状态进行修改。在子类中，主要通过AQS提供的下面3个方法对同步状态的访问和转换进行操作：

- `getState() `：获取当前的同步状态
- `setState(int newState)`： 设置新的同步状态
- `compareAndSetState(int expect,int update)`： 调用`Unsafe`类的`compareAndSwapInt`方法，使用CAS操作更新同步状态，保证了状态修改的原子性

线程会试图修改`state`的值，如果修改成功那么表示线程得到或释放了同步状态，如果失败就会将当前线程封装成一个`Node`节点，然后将其加入到同步队列中，并阻塞当前线程。

#### 设计思想

AQS的设计使用了**模板方法**的设计模式，模板方法一般在父类中封装不变的部分（如算法骨架），把扩展的可变部分交给子类进行扩展，子类的执行结果会影响父类的结果，是一种反向的控制结构。AQS中应用了这种设计模式，将一部分方法交给子类进行重写，而自定义的同步组件在调用同步器提供的模板方法（父类中的方法）时，又会调用子类重写的方法。

以AQS类中常用于获取锁的`acquire`方法为例，它的代码如下：

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

`acquire`方法被`final`修饰，不可以在子类中重写，因为它是对外提供的模板方法，有相对具体和固定的执行逻辑。在`acquire`方法中调用了`tryAcquire`方法：

```java
protected boolean tryAcquire(int arg) {
    throw new UnsupportedOperationException();
}
```

可以看到带有`protected`修饰的`tryAcquire`方法是一个空壳方法，并没有定义实际获取同步状态的逻辑，这就需要我们在继承AQS的子类中对齐进行重写，从而达到扩展目的。在重写过程中，就会用到上面提到的获取和修改同步状态的3个方法`getState`、`setState`和`compareAndSetState`。

以`ReentrantLock`中的方法调用为例，当调用`ReentrantLock`中的`lock`方法时，会调用继承了AQS的内部类`Sync`的父类中的`acquire`方法，`acquire`方法再调用子类`Sync`的`tryAcquire`方法并返回`boolean`类型结果。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3ffba2843a4b47ca81003623b0e578b6~tplv-k3u1fbpfcp-zoom-1.image)

除了`tryAcquire`方法外，子类中还提供了其他可以重写的方法，列出如下：

- `tryAcquire`：独占式获取同步状态
- `tryRelease`：独占式释放同步状态
- `tryAcquireShared`：共享式获取同步状态
- `tryReleaseShared`：共享式释放同步状态
- `isHeldExclusively`：当前线程是否独占式的占用同步状态

而我们在实现自定义的同步组件时，可以直接调用AQS提供的下面这些模板方法：

- `acquire`：独占式获取同步状态，如果线程获取同步状态成功那么方法返回，否则线程阻塞，进入同步队列中
- `acquireInterruptibly`：在`acquire`基础上，添加了响应中断功能
- `tryAcquireNanos`：在`acquireInterruptibly`基础上，添加了超时限制，超时会返回`false`
- `acquireShared`：共享式获取同步状态，如果线程获取同步状态成功那么方法返回，否则线程进入同步队列中阻塞。与`acquire`不同，该方法允许多个线程同时获取锁
- `acquireSharedInterruptibly`：在`acquireShared`基础上，可响应中断
- `tryAcquireSharedNanos`：在`acquireSharedInterruptibly`基础上，添加了超时限制
- `release`：独占式释放同步状态，将唤醒同步队列中第一个节点的线程
- `releaseShared`：共享式释放同步状态
- `getQueuedThreads`：获取等待在同步队列上的线程集合

从模板方法中可以看出，大多方法都是独占模式和共享模式对称出现的，除去查询等待线程方法外，可以将他们分为两类：独占式获取或释放同步状态、共享式获取或释放同步状态，并且它们的核心都是`acquire`与`release`方法，其他方法只是在它们实现的基础上做了部分的逻辑改动，增加了中断和超时功能的支持。下面对主要的4个方法进行分析。

### 2、源码分析

#### acquire 

分析上面`acquire`方法中源码的执行流程：

1.首先调用`tryAcquire`尝试获取同步状态，如果获取成功，那么直接返回

2.如果获取同步状态失败，调用`addWaiter`方法生成新`Node`节点并加入同步队列：

```java
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    // Try the fast path of enq; backup to full enq on failure
    Node pred = tail;
    if (pred != null) {
        node.prev = pred;
        if (compareAndSetTail(pred, node)) {
            pred.next = node;
            return node;
        }
    }
    enq(node);
    return node;
}
```

方法中使用当前线程和等待状态构造了一个新的`Node`节点，在同步队列的队尾节点不为空的情况下（说明同步队列非空），调用`compareAndSetTail`方法以CAS的方式把新节点设置为同步队列的队尾节点。如果队尾节点为空或添加新节点失败，则调用`enq`方法：

```java
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // Must initialize
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

在同步队列为空的情况下，会先创建一个新的空节点作为头节点，然后通过CAS的方式将当前线程创建的`Node`设为尾节点。在for循环中，只有通过CAS将节点插入到队尾后才会返回，否则就会重复循环，通过这样的方式，能够将并发添加节点的操作变为串行添加，保证了线程的安全性。这一过程可以使用下图表示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3e9f68236f564640ab2ad700efa097f5~tplv-k3u1fbpfcp-zoom-1.image)

3.添加新节点完成后，调用`acquireQueued`方法，尝试以自旋的方式获取同步状态：

```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();
            if (p == head && tryAcquire(arg)) {
                setHead(node);
                p.next = null; // help GC
                failed = false;
                return interrupted;
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

当新添加的`Node`的前驱节点是同步队列的头节点并且尝试获取同步状态成功时，线程将`Node`设为头节点并从自旋中退出，否则调用`shouldParkAfterFailedAcquire`方法判断是否需要挂起：

```java
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus;
    if (ws == Node.SIGNAL)
        return true;
    if (ws > 0) {
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}
```

在该方法中，传入的第一个`Node`类型的参数是当前节点的前驱节点，对其等待状态进行判断：

- 如果为`SIGNAL`状态，那么前驱节点释放同步状态或取消时都会通知后继节点，因此可以将当前线程阻塞，返回`true`
- 如果大于0，那么为`CANCEL`状态，表示前驱节点被取消，那么一直向前回溯，找到一个不为`CANCEL`状态的节点，并将当前节点的前驱指向它
- 如果不是上面的两种情况，那么将前驱节点的等待状态设为`SIGNAL`。这里的目的是在每个节点进入阻塞状态前将前驱节点的等待状态设为`SIGNAL`，否则节点将无法被唤醒
- 在后两种情况下，都会返回`false`，然后在`acquireQueued`方法中进行循环，直到进入`shouldParkAfterFailedAcquire`方法时为第一种情况，阻塞线程

当返回为`true`时，调用`parkAndCheckInterrupt`方法：

```java
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this);
    return Thread.interrupted();
}
```

在方法内部调用了`LockSupport`的`park`方法，阻塞当前线程，并返回当前线程是否被中断的状态。

在上面的代码中，各节点通过自旋的方式检测自己的前驱节点是否头节点的过程，可用下图表示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/94028b9ec936421a848c5e874e243506~tplv-k3u1fbpfcp-zoom-1.image)

4.当满足条件，返回`acquire`方法后，调用`selfInterrupt`方法。方法内部使用`interrupt`方法，唤醒被阻塞的线程，继续向下执行：

```java
static void selfInterrupt() {
    Thread.currentThread().interrupt();
}
```

最后，使用流程图的方式总结`acquire`方法独占式获取锁的整体流程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fec96b2c188248e581e51c37777ec102~tplv-k3u1fbpfcp-zoom-1.image)

#### release

与`acquire`方法对应，`release`方法负责独占式释放同步状态，流程也相对简单。在`ReentrantLock`中，`unlock`方法就是直接调用的AQS的`release`方法。先来直接看一下它的源码：

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}
```

1.方法中首先调用子类重写的`tryRelease`方法，尝试释放当前线程持有的同步状态，如果成功则向下执行，失败返回`false`

2.如果同步队列的头节点不为空且等待状态不为初始状态，那么将调用`unparkSuccessor`方法唤醒它的后继节点：

```java
private void unparkSuccessor(Node node) {
    int ws = node.waitStatus;
    if (ws < 0)
        compareAndSetWaitStatus(node, ws, 0);
    Node s = node.next;
    if (s == null || s.waitStatus > 0) {
        s = null;
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0)
                s = t;
    }
    if (s != null)
        LockSupport.unpark(s.thread);
}
```

方法主要实现的功能有：

- 如果头节点的等待状态小于0，使用CAS将它置为0
- 如果后续节点为空、或它的等待状态为`CANCEL`被取消，那么从队尾开始，向前寻找最靠近队列头部的一个等待状态小于0 的节点
- 找到符合条件的节点后，调用`LockSupport`工具类的`unpark`方法，唤醒后继节点中对应的线程

同步队列新头节点的设置过程如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14a358d1c1f34e378bf3f882b670eafa~tplv-k3u1fbpfcp-zoom-1.image)

在上面的过程中，采用的是从后向前遍历寻找未取消节点的方式，这是因为AQS的同步队列是一个**弱一致性**的双向列表，在下面的情况中，存在`next`指针为`null`的情况：

- 在`enq`方法插入新节点时，可能存在旧尾节点的`next`指针还未指向新节点的情况
- 在`shouldParkAfterFailedAcquire`方法中，当移除`CANCEL`状态的节点时，也存在`next`指针还未指向后续节点的情况

#### acquireShared

在了解了独占式获取同步状态后，再来看一下共享式获取同步状态。在共享模式下，允许多个线程同时获取到同步状态，来看一下它的源码：

```java
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0)
        doAcquireShared(arg);
}
```

首先调用子类重写的`tryAcquireShared`方法，返回值为`int`类型，如果值大于等于0表示获取同步状态成功，那么直接返回。如果小于0表示获取失败，执行下面的`doAcquireShared`方法，将线程放入等待队列使用自旋尝试获取，直到获取同步状态成功：

```java
private void doAcquireShared(int arg) {
    final Node node = addWaiter(Node.SHARED);
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();
            if (p == head) {
                int r = tryAcquireShared(arg);
                if (r >= 0) {
                    setHeadAndPropagate(node, r);
                    p.next = null; // help GC
                    if (interrupted)
                        selfInterrupt();
                    failed = false;
                    return;
                }
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

对上面的代码进行简要的解释：

1.调用`addWaiter`方法，封装新节点，并以共享模式（`Node.SHARED`）将节点放入同步队列中队尾

2.在`for`循环中，获取当前节点的前驱节点，如果前驱节点是同步队列的头节点，那么就以共享模式去尝试获取同步状态，判断`tryAcquireShared`的返回值，如果返回值大于等于0，表示获取同步状态成功，修改新的头节点，并将信息传播给同步队列中的后继节点，然后检查中断标志位，如果线程被阻塞，那么进行唤醒

3.如果前驱节点不是头节点、或获取同步状态失败时，调用`shouldParkAfterFailedAcquire`判断是否需要阻塞，如果需要则调用`parkAndCheckInterrupt`，在前驱节点的等待状态为`SIGNAL`时，将节点对应的线程阻塞

可以看到，共享式的获取同步状态的调用过程和`acquire`方法非常相似，但不同的是在获取同步状态成功后，会调用`setHeadAndPropagate`方法进行共享式同步状态的传播：

```java
private void setHeadAndPropagate(Node node, int propagate) {
    Node h = head; // Record old head for check below
    setHead(node);
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        if (s == null || s.isShared())
            doReleaseShared();
    }
}
```

因为共享式同步状态是允许多个线程共享的，所以在一个线程获取到同步状态后，需要在第一时间通知后继节点的线程可以尝试获取同步资源，这样就可以避免其他线程阻塞时间过长。在方法中，把当前节点设置为头节点后，需要根据情况判断后继节点是否需要释放：

- `propagate>0`：表示还拥有剩余的同步资源，从`doAcquireShared`方法中执行到这时，取值是大于等于0的，在等于0的情况下，会继续下面的判断

- `h == null`：原头节点为空，一般情况下不满足，有可能发生在原头节点被`gc`回收的情况，此条不满足情况则向下继续判断

- `h.waitStatus < 0`：原头节点的等待状态可能取值为0或-3

  - 当某个线程释放同步资源或者前一个节点共享式获取同步状态时（会执行下面的`doReleaseShared`方法），会将自己的`waitStatus`从-1改变为0

  - 这时可能后继节点还没有来的及将自己更新为头节点，如果有其他的线程在这个时候再调用`doReleaseShared`方法，那么取到的还是原头节点，会把它的`waitStatus`从0改变为-3，在这个过程中，说明其他线程调用`doReleaseShared`释放了同步资源

- `(h = head) == null`：新头节点为空，一般情况下不满足，会向下继续判断

- `h.waitStatus < 0`：新头节点的等待状态可能取值为0或-3或-1

  - 如果后继节点刚加入队列，还没有运行到`shouldParkAfterFailedAcquire`方法，修改其前驱节点的等待状态时，此时可能为0
  - 如果节点被唤醒成为了新的头节点，并且此时后继节点才刚被加入同步队列，又有其他线程释放锁调用了`doReleaseShared`，会把头节点的状态从0改为-3
  - 队列中的节点已经调用了`shouldParkAfterFailedAcquire`，会把`waitStatus` 从0或-3 改为-1

如果满足上面的任何一种状态，并且它的后继节点是`SHARED`状态的，则执行`doReleaseShared`方法释放后继节点：

```java
private void doReleaseShared() {
    for (;;) {
        Node h = head;
        if (h != null && h != tail) {
            int ws = h.waitStatus;
            if (ws == Node.SIGNAL) {
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue; // loop to recheck cases
                unparkSuccessor(h);
            }
            else if (ws == 0 &&
                     !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                continue; // loop on failed CAS
        }
        if (h == head) // loop if head changed
            break;
    }
}
```

`doReleaseShared`方法不仅在这里的共享状态传播的情况下被调用，还会在后面介绍的共享式释放同步状态中被调用。在方法中，当头节点不为空且不等于尾节点（意味着没有后继节点需要等待唤醒）时：

- 先将头节点从`SIGNAL`状态更新为0，然后调用`unparkSuccessor`方法唤醒头节点的后继节点
- 将头节点的状态从0更新为`PROPAGATE`，表明状态需要向后继节点传播
- 如果头节点在更新状态的时候没有发生改变，则退出循环

通过上面的流程，就实现了从头节点尝试向后唤醒节点，实现了共享状态的向后传播。

#### releaseShared

最后，再来看一下对应的共享式释放同步状态方法：

```java
    public final boolean releaseShared(int arg) {
        if (tryReleaseShared(arg)) {
            doReleaseShared();
            return true;
        }
        return false;
    }
```

`releaseShared`方法会释放指定量的资源，如果调用子类重写的`tryReleaseShared`方法返回值为`true`，表示释放成功，那么还是执行上面介绍过的`doReleaseShared`方法唤醒同步队列中的等待线程。

### 3、自定义同步组件

在前面的介绍中说过，在使用AQS时，需要定义一个子类继承`AbstractQueuedSynchronizer`抽象类，并实现它的抽象方法来管理同步状态。接下来我们就来手写一个独占式的锁，按照文档中的推荐，我们将子类定义为自定义同步工具类的静态内部类：

```java
public class MyLock {
    private static class AqsHelper extends AbstractQueuedSynchronizer {
        @Override
        protected boolean tryAcquire(int arg) {
            int state = getState();
            if (state == 0) {
                if (compareAndSetState(0, arg)) {
                    setExclusiveOwnerThread(Thread.currentThread());
                    return true;
                }
            } else if (getExclusiveOwnerThread() == Thread.currentThread()) {
                setState(getState() + arg);
                return true;
            }
            return false;
        }
        @Override
        protected boolean tryRelease(int arg) {
            int state = getState() - arg;
            if (state == 0) {
                setExclusiveOwnerThread(null);
                setState(state);
                return true;
            }
            setState(state);
            return false;
        }
        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }
    }
    
    private final AqsHelper aqsHelper = new AqsHelper();
    public void lock() {
        aqsHelper.acquire(1);
    }
    public boolean tryLock() {
        return aqsHelper.tryAcquire(1);
    }
    public void unlock() {
        aqsHelper.release(1);
    }
    public boolean isLocked() {
        return aqsHelper.isHeldExclusively();
    }
}
```

在AQS的子类中，首先重写了`tryAcquire`方法，在方法中利用CAS来修改`state`的状态值，并在修改成功时设置当前线程独占资源。并且通过比较尝试获取锁的线程与持有锁的线程是否相同的方式，来实现了锁的可重入性。在重写的`tryRelease`方法中，进行资源的释放，如果存在重入的情况，会一直到所有重入锁释放完才会真正的释放锁，并放弃占有状态。

可以注意到在自定义的锁工具类中，我们定义了`lock`和`tryLock`两个方法，分别调用了`acquire`和`tryAcquire`方法，它们的区别是`lock`会等待锁资源，直到成功时才会返回，而`tryLock`尝试获取锁时，会立即返回成功或失败的状态。

接下来，我们通过下面的测试代码，验证自定义的锁的有效性：

```java
public class Test {
    private MyLock lock=new MyLock();
    private int i=0;
    public void sayHi(){
        try {
            lock.lock();
            System.out.println("i am "+i++);
        }finally {
            lock.unlock();
        }
    }
    public static void main(String[] args) {
        Test test=new Test();
        Thread[] th=new Thread[20];
        for (int i = 0; i < 20; i++) {
            new Thread(()->{
                test.sayHi();
            }).start();
        }
    }
}
```

运行上面的测试代码，结果如下，可以看见通过加锁保证了对变量`i`的同步访问控制：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/37ff938c68ef426e9ec4fec72b31ceb6~tplv-k3u1fbpfcp-zoom-1.image)

接下来通过下面的例子测试锁的可重入性：

```java
public class Test2 {
    private MyLock lock=new MyLock();
    public void function1(){
        lock.lock();
        System.out.println("execute function1");
        function2();
        lock.unlock();
    }
    public void function2(){
        lock.lock();
        System.out.println("execute function2");
        lock.unlock();
    }
    public static void main(String[] args) {
        Test2 test2=new Test2();
        new Thread(()->{
            test2.function1();
        }).start();
    }
}
```

执行上面的代码，可以看到在`function1`未释放锁的情况下，`function2`对锁进行了重入并执行了后续的代码：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7cdeee128917423697205c71d6891d9f~tplv-k3u1fbpfcp-zoom-1.image)

### 总结

通过上面的学习，我们了解了AQS的两大核心同步队列和同步状态，并对AQS对资源的管理以及队列状态的变化有了一定的研究。其实归根结底，AQS只是提供给我们来开发同步组件的一个底层框架，在它的层面上，并不关心子类在继承它时要实现什么功能，AQS只是提供了一套维护同步状态的功能，至于要完成什么样的一个工具类，这完全是由我们自己去定义的。

