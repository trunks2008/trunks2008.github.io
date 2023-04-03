---
title: 再谈synchronized锁升级
icon: page
order: 6
author: Hydra
date: 2021-04-03
tag:
  - synchronized
  - 并发
star: true
---



<!-- more -->

在`图文详解Java对象内存布局`这篇文章中，在研究对象头时我们了解了`synchronized`锁升级的过程，由于篇幅有限，对锁升级的过程介绍的比较简略，本文在上一篇的基础上，来详细研究一下锁升级的过程以及各个状态下锁的原理。本文结构如下：

- 1 无锁
- 2 偏向锁
- 3 轻量级锁
- 4 重量级锁
- 总结

### 1 无锁

在上一篇文章中，我们提到过 jvm会有4秒的偏向锁开启的延迟时间，在这个偏向延迟内对象处于为无锁态。如果关闭偏向锁启动延迟、或是经过4秒且没有线程竞争对象的锁，那么对象会进入**无锁可偏向**状态。

准确来说，无锁可偏向状态应该叫做**匿名偏向**(`Anonymously biased`)状态，因为这时对象的`mark word`中后三位已经是`101`，但是`threadId`指针部分仍然全部为0，它还没有向任何线程偏向。综上所述，对象在刚被创建时，根据jvm的配置对象可能会处于 **无锁** 或 **匿名偏向** 两个状态。

此外，如果在jvm的参数中关闭偏向锁，那么直到有线程获取这个锁对象之前，会一直处于无锁不可偏向状态。修改jvm启动参数：

```shell
-XX:-UseBiasedLocking
```

延迟5s后打印对象内存布局：

```java
public static void main(String[] args) throws InterruptedException {
    User user=new User();
    TimeUnit.SECONDS.sleep(5);
    System.out.println(ClassLayout.parseInstance(user).toPrintable());
}
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/98341717a4cc40fa9a4ac905bc144956~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，即使经过一定的启动延时，对象一直处于`001`无锁不可偏向状态。大家可能会有疑问，在无锁状态下，为什么要存在一个不可偏向状态呢？通过查阅资料得到的解释是：

> JVM内部的代码有很多地方也用到了synchronized，明确在这些地方存在线程的竞争，如果还需要从偏向状态再逐步升级，会带来额外的性能损耗，所以JVM设置了一个偏向锁的启动延迟，来降低性能损耗

也就是说，在无锁不可偏向状态下，如果有线程试图获取锁，那么将跳过升级偏向锁的过程，直接使用轻量级锁。使用代码进行验证：

```java
//-XX:-UseBiasedLocking
public static void main(String[] args) throws InterruptedException {
    User user=new User();
    synchronized (user){
        System.out.println(ClassLayout.parseInstance(user).toPrintable());
    }
}
```

查看结果可以看到，在关闭偏向锁情况下使用`synchronized`，锁会直接升级为轻量级锁（`00`状态）:

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abdb2ff9b1ce4e59a6c13a318153c966~tplv-k3u1fbpfcp-zoom-1.image)

在目前的基础上，可以用流程图概括上面的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/161e330cbab4400aa27a436c45c17ac6~tplv-k3u1fbpfcp-zoom-1.image)

额外注意一点就是匿名偏向状态下，如果调用系统的`hashCode()`方法，会使对象回到无锁态，并在`markword`中写入`hashCode`。并且在这个状态下，如果有线程尝试获取锁，会直接从无锁升级到轻量级锁，不会再升级为偏向锁。

### 2 偏向锁

#### 2.1 偏向锁原理

匿名偏向状态是偏向锁的初始状态，在这个状态下第一个试图获取该对象的锁的线程，会使用CAS操作（汇编命令`CMPXCHG`）尝试将自己的`threadID`写入对象头的`mark word`中，使匿名偏向状态升级为**已偏向**（Biased）的偏向锁状态。在已偏向状态下，线程指针`threadID`非空，且偏向锁的时间戳`epoch`为有效值。

如果之后有线程再次尝试获取锁时，需要检查`mark word`中存储的`threadID`是否与自己相同即可，如果相同那么表示当前线程已经获得了对象的锁，不需要再使用CAS操作来进行加锁。

如果`mark word`中存储的`threadID`与当前线程不同，那么将执行CAS操作，试图将当前线程的ID替换`mark word`中的`threadID`。只有当对象处于下面两种状态中时，才可以执行成功：

- 对象处于匿名偏向状态
- 对象处于**可重偏向**（Rebiasable）状态，新线程可使用CAS将`threadID`指向自己

如果对象不处于上面两个状态，说明锁存在线程竞争，在CAS替换失败后会执行**偏向锁撤销**操作。偏向锁的撤销需要等待全局安全点`Safe Point`（安全点是 jvm为了保证在垃圾回收的过程中引用关系不会发生变化设置的安全状态，在这个状态上会暂停所有线程工作），在这个安全点会挂起获得偏向锁的线程。

在暂停线程后，会通过遍历当前jvm的所有线程的方式，检查持有偏向锁的线程状态是否存活：

- 如果线程还存活，且线程正在执行同步代码块中的代码，则升级为轻量级锁
- 如果持有偏向锁的线程未存活，或者持有偏向锁的线程未在执行同步代码块中的代码，则进行校验是否允许重偏向：
  - 不允许重偏向，则撤销偏向锁，将`mark word`升级为轻量级锁，进行CAS竞争锁

  - 允许重偏向，设置为匿名偏向锁状态，CAS将偏向锁重新指向新线程

完成上面的操作后，唤醒暂停的线程，从安全点继续执行代码。可以使用流程图总结上面的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5248e8eac4ee49d3bbc0943fac2e12f2~tplv-k3u1fbpfcp-zoom-1.image)

#### 2.2 偏向锁升级

在上面的过程中，我们已经知道了匿名偏向状态可以变为无锁态或升级为偏向锁，接下来看一下偏向锁的其他状态的改变

- 偏向锁升级为轻量级锁

```java
public static void main(String[] args) throws InterruptedException {
    User user=new User();
    synchronized (user){
        System.out.println(ClassLayout.parseInstance(user).toPrintable());
    }
    Thread thread = new Thread(() -> {
        synchronized (user) {
            System.out.println("--THREAD--:"+ClassLayout.parseInstance(user).toPrintable());
        }
    });
    thread.start();
    thread.join();
    System.out.println("--END--:"+ClassLayout.parseInstance(user).toPrintable());
}
```

查看内存布局，偏向锁升级为轻量级锁，在执行完成同步代码后释放锁，变为无锁不可偏向状态：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/75af0582fae949c081e638a996d72e3b~tplv-k3u1fbpfcp-zoom-1.image)

- 偏向锁升级为重量级锁

```java
public static void main(String[] args) throws InterruptedException {
    User user=new User();
    Thread thread = new Thread(() -> {
        synchronized (user) {
            System.out.println("--THREAD1--:" + ClassLayout.parseInstance(user).toPrintable());
            try {
                user.wait(2000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("--THREAD END--:" + ClassLayout.parseInstance(user).toPrintable());
        }
    });
    thread.start();
    thread.join();
    TimeUnit.SECONDS.sleep(3);
    System.out.println(ClassLayout.parseInstance(user).toPrintable());
}
```

查看内存布局，可以看到在调用了对象的`wait()`方法后，直接从偏向锁升级成了重量级锁，并在锁释放后变为无锁态：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0a72c4736d7b4872a22c3c0a5548ca86~tplv-k3u1fbpfcp-zoom-1.image)

这里是因为`wait()`方法调用过程中依赖于重量级锁中与对象关联的`monitor`，在调用`wait()`方法后`monitor`会把线程变为`WAITING`状态，所以才会强制升级为重量级锁。除此之外，调用`hashCode`方法时也会使偏向锁直接升级为重量级锁。

在上面分析的基础上，再加上我们上一篇中讲到的轻量级锁升级到重量级锁的知识，就可以对上面的流程图进行完善了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bf537215a54547d184e624c903cfc00e~tplv-k3u1fbpfcp-zoom-1.image)

#### 2.3 批量重偏向

在未禁用偏向锁的情况下，当一个线程建立了大量对象，并且对它们执行完同步操作解锁后，所有对象处于偏向锁状态，此时若再来另一个线程也尝试获取这些对象的锁，就会导偏向锁的**批量重偏向**（Bulk Rebias）。当触发批量重偏向后，第一个线程结束同步操作后的锁对象当再被同步访问时会被重置为可重偏向状态，以便允许快速重偏向，这样能够减少撤销偏向锁再升级为轻量级锁的性能消耗。

首先看一下和偏向锁有关的参数，修改jvm启动参数，使用下面的命令可以在项目启动时打印jvm的默认参数值：

```shell
-XX:+PrintFlagsFinal
```

需要关注的属性有下面3个：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/565f9a97140a4c62893132cf47ec6ccf~tplv-k3u1fbpfcp-zoom-1.image)

- `BiasedLockingBulkRebiasThreshold`：偏向锁批量重偏向阈值，默认为20次
- `BiasedLockingBulkRevokeThreshold`：偏向锁批量撤销阈值，默认为40次
- `BiasedLockingDecayTime`：重置计数的延迟时间，默认值为25000毫秒（即25秒）

批量重偏向是以`class`而不是对象为单位的，每个`class`会维护一个偏向锁的撤销计数器，每当该`class`的对象发生偏向锁的撤销时，该计数器会加一，当这个值达到默认阈值20时，jvm就会认为这个锁对象不再适合原线程，因此进行批量重偏向。而距离上次批量重偏向的25秒内，如果撤销计数达到40，就会发生批量撤销，如果超过25秒，那么就会重置在[20, 40)内的计数。

上面这段理论是不是听上去有些难理解，没关系，我们先用代码验证批量重偏向的过程：

```java
private static Thread t1,t2;
public static void main(String[] args) throws InterruptedException {      
    TimeUnit.SECONDS.sleep(5);
    List<Object> list = new ArrayList<>();
    for (int i = 0; i < 40; i++) {
        list.add(new Object());
    }

    t1 = new Thread(() -> {
        for (int i = 0; i < list.size(); i++) {
            synchronized (list.get(i)) {
            }
        }
        LockSupport.unpark(t2);
    });
    t2 = new Thread(() -> {
        LockSupport.park();
        for (int i = 0; i < 30; i++) {
            Object o = list.get(i);
            synchronized (o) {
                if (i == 18 || i == 19) {
                    System.out.println("THREAD-2 Object"+(i+1)+":"+ClassLayout.parseInstance(o).toPrintable());
                }
            }
        }
    });
    t1.start();
    t2.start();
    t2.join();

    TimeUnit.SECONDS.sleep(3);
    System.out.println("Object19:"+ClassLayout.parseInstance(list.get(18)).toPrintable());
    System.out.println("Object20:"+ClassLayout.parseInstance(list.get(19)).toPrintable());
    System.out.println("Object30:"+ClassLayout.parseInstance(list.get(29)).toPrintable());
    System.out.println("Object31:"+ClassLayout.parseInstance(list.get(30)).toPrintable());
}
```

分析上面的代码，当线程`t1`运行结束后，数组中所有对象的锁都偏向`t1`，然后`t1`唤醒被挂起的线程`t2`，线程`t2`尝试获取前30个对象的锁。我们打印线程`t2`获取到的第19和第20个对象的锁状态：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ec6a256fa6c848beaa457cbaa8cfcd6f~tplv-k3u1fbpfcp-zoom-1.image)

线程`t2`在访问前19个对象时对象的偏向锁会升级到轻量级锁，在访问后11个对象（下标19-29）时，因为偏向锁撤销次数达到了20，会触发批量重偏向，将锁的状态变为偏向线程`t2`。在全部线程结束后，再次查看第19、20、30、31个对象锁的状态：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e187859179684995b0b74fc453a679f0~tplv-k3u1fbpfcp-zoom-1.image)

线程`t2`结束后，第1-19的对象释放轻量级锁变为无锁不可偏向状态，第20-30的对象状态为偏向锁、但从偏向`t1`改为偏向`t2`，第31-40的对象因为没有被线程`t2`访问所以保持偏向线程`t1`不变。

#### 2.4 批量撤销

在多线程竞争激烈的状况下，使用偏向锁将会导致性能降低，因此产生了批量撤销机制，接下来使用代码进行测试：

```java
private static Thread t1, t2, t3;
public static void main(String[] args) throws InterruptedException {
    TimeUnit.SECONDS.sleep(5);

    List<Object> list = new ArrayList<>();
    for (int i = 0; i < 40; i++) {
        list.add(new Object());
    }

    t1 = new Thread(() -> {
        for (int i = 0; i < list.size(); i++) {
            synchronized (list.get(i)) {
            }
        }
        LockSupport.unpark(t2);
    });
    t2 = new Thread(() -> {
        LockSupport.park();
        for (int i = 0; i < list.size(); i++) {
            Object o = list.get(i);
            synchronized (o) {
                if (i == 18 || i == 19) {
                    System.out.println("THREAD-2 Object"+(i+1)+":"+ClassLayout.parseInstance(o).toPrintable());
                }
            }
        }
        LockSupport.unpark(t3);
    });
    t3 = new Thread(() -> {
        LockSupport.park();
        for (int i = 0; i < list.size(); i++) {
            Object o = list.get(i);
            synchronized (o) {
                System.out.println("THREAD-3 Object"+(i+1)+":"+ClassLayout.parseInstance(o).toPrintable());
            }
        }
    });

    t1.start();
    t2.start();
    t3.start();
    t3.join();
    System.out.println("New: "+ClassLayout.parseInstance(new Object()).toPrintable());
}
```

对上面的运行流程进行分析：

- 线程`t1`中，第1-40的锁对象状态变为偏向锁
- 线程`t2`中，第1-19的锁对象撤销偏向锁升级为轻量级锁，然后对第20-40的对象进行批量重偏向
- 线程`t3`中，首先直接对第1-19个对象竞争轻量级锁，而从第20个对象开始往后的对象不会再次进行批量重偏向，因此第20-39的对象进行偏向锁撤销升级为轻量级锁，这时`t2`和`t3`线程一共执行了40次的锁撤销，触发锁的批量撤销机制，对偏向锁进行撤销置为轻量级锁

看一下在3个线程都结束后创建的新对象：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2825e99f5d5845d4898cd9f4c8dd691e~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，创建的新对象为无锁不可偏向状态`001`，说明当类触发了批量撤销机制后，jvm会禁用该类创建对象时的可偏向性，该类新创建的对象全部为无锁不可偏向状态。

#### 2.5 总结

偏向锁通过消除资源无竞争情况下的同步原语，提高了程序在**单线程**下访问同步资源的运行性能，但是当出现多个线程竞争时，就会撤销偏向锁、升级为轻量级锁。

如果我们的应用系统是高并发、并且代码中同步资源一直是被多线程访问的，那么撤销偏向锁这一步就显得多余，偏向锁撤销时进入`Safe Point`产生`STW`的现象应该是被极力避免的，这时应该通过禁用偏向锁来减少性能上的损耗。

### 3 轻量级锁

#### 3.1 轻量级锁原理

1、在代码访问同步资源时，如果锁对象处于无锁不可偏向状态，jvm首先将在当前线程的栈帧中创建一条锁记录（`lock record`），用于存放：

- `displaced mark word`（置换标记字）：存放锁对象当前的`mark word`的拷贝
- `owner`指针：指向当前的锁对象的指针，在拷贝`mark word`阶段暂时不会处理它

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e1d5f720a35f44f48b68e76bd866b8ac~tplv-k3u1fbpfcp-zoom-1.image)

2、在拷贝`mark word`完成后，首先会挂起线程，jvm使用CAS操作尝试将对象的 `mark word` 中的 `lock record` 指针指向栈帧中的锁记录，并将锁记录中的`owner`指针指向锁对象的`mark word`

- 如果CAS替换成功，表示竞争锁对象成功，则将锁标志位设置成 `00`，表示对象处于轻量级锁状态，执行同步代码中的操作

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4395df08e8b46fdb6cbe050143fdf0b~tplv-k3u1fbpfcp-zoom-1.image)

- 如果CAS替换失败，则判断当前对象的`mark word`是否指向当前线程的栈帧：
  - 如果是则表示当前线程已经持有对象的锁，执行的是`synchronized`的锁重入过程，可以直接执行同步代码块
  - 否则说明该其他线程已经持有了该对象的锁，如果在自旋一定次数后仍未获得锁，那么轻量级锁需要升级为重量级锁，将锁标志位变成`10`，后面等待的线程将会进入阻塞状态

4、轻量级锁的释放同样使用了CAS操作，尝试将`displaced mark word` 替换回`mark word`，这时需要检查锁对象的`mark word`中`lock record`指针是否指向当前线程的锁记录：

- 如果替换成功，则表示没有竞争发生，整个同步过程就完成了
- 如果替换失败，则表示当前锁资源存在竞争，有可能其他线程在这段时间里尝试过获取锁失败，导致自身被挂起，并修改了锁对象的`mark word`升级为重量级锁，最后在执行重量级锁的解锁流程后唤醒被挂起的线程

用流程图对上面的过程进行描述：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c7d2eb31b75452b8a9c76882f27bdd8~tplv-k3u1fbpfcp-zoom-1.image)

#### 3.2 轻量级锁重入

我们知道，`synchronized`是可以锁重入的，在轻量级锁的情况下重入也是依赖于栈上的`lock record`完成的。以下面的代码中3次锁重入为例：

```java
synchronized (user){
    synchronized (user){
        synchronized (user){
            //TODO
        }
    }
}
```

轻量级锁的每次重入，都会在栈中生成一个`lock record`，但是保存的数据不同：

- 首次分配的`lock record`，`displaced mark word`复制了锁对象的`mark word`，`owner`指针指向锁对象
- 之后重入时在栈中分配的`lock record`中的`displaced mark word`为`null`，只存储了指向对象的`owner`指针

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6f3410d7fe0741a5bdcaf94987e725f0~tplv-k3u1fbpfcp-zoom-1.image)

轻量级锁中，重入的次数等于该锁对象在栈帧中`lock record`的数量，这个数量隐式地充当了锁重入机制的计数器。这里需要计数的原因是每次解锁都需要对应一次加锁，只有最后解锁次数等于加锁次数时，锁对象才会被真正释放。在释放锁的过程中，如果是重入则删除栈中的`lock record`，直到没有重入时则使用CAS替换锁对象的`mark word`。

#### 3.3 轻量级锁升级

在jdk1.6以前，默认轻量级锁自旋次数是10次，如果超过这个次数或自旋线程数超过CPU核数的一半，就会升级为重量级锁。这时因为如果自旋次数过多，或过多线程进入自旋，会导致消耗过多cpu资源，重量级锁情况下线程进入等待队列可以降低cpu资源的消耗。自旋次数的值也可以通过jvm参数进行修改：

```shell
-XX:PreBlockSpin
```

 jdk1.6以后加入了**自适应自旋锁** （`Adapative Self Spinning`），自旋的次数不再固定，由jvm自己控制，由前一次在同一个锁上的自旋时间及锁的拥有者的状态来决定：

- 对于某个锁对象，如果自旋等待刚刚成功获得过锁，并且持有锁的线程正在运行中，那么虚拟机就会认为这次自旋也是很有可能再次成功，进而允许自旋等待持续相对更长时间
- 对于某个锁对象，如果自旋很少成功获得过锁，那在以后尝试获取这个锁时将可能省略掉自旋过程，直接阻塞线程，避免浪费处理器资源。

下面通过代码验证轻量级锁升级为重量级锁的过程：

```java
public static void main(String[] args) throws InterruptedException {
    User user = new User();
    System.out.println("--MAIN--:" + ClassLayout.parseInstance(user).toPrintable());
    Thread thread1 = new Thread(() -> {
        synchronized (user) {
            System.out.println("--THREAD1--:" + ClassLayout.parseInstance(user).toPrintable());
            try {
                TimeUnit.SECONDS.sleep(5);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    });
    Thread thread2 = new Thread(() -> {
        try {
            TimeUnit.SECONDS.sleep(2);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        synchronized (user) {
            System.out.println("--THREAD2--:" + ClassLayout.parseInstance(user).toPrintable());
        }
    });

    thread1.start();
    thread2.start();
    thread1.join();
    thread2.join();
    TimeUnit.SECONDS.sleep(3);
    System.out.println(ClassLayout.parseInstance(user).toPrintable());
}
```

在上面的代码中，线程2在启动后休眠两秒后再尝试获取锁，确保线程1能够先得到锁，在此基础上造成锁对象的资源竞争。查看对象锁状态变化：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/64edc4b366a747418f2d96cad90cc784~tplv-k3u1fbpfcp-zoom-1.image)

在线程1持有轻量级锁的情况下，线程2尝试获取锁，导致资源竞争，使轻量级锁升级到重量级锁。在两个线程都运行结束后，可以看到对象的状态恢复为了无锁不可偏向状态，在下一次线程尝试获取锁时，会直接从轻量级锁状态开始。

上面在最后一次打印前将主线程休眠3秒的原因是锁的释放过程需要一定的时间，如果在线程执行完成后直接打印对象内存布局，对象可能仍处于重量级锁状态。

#### 3.4 总结

轻量级锁与偏向锁类似，都是jdk对于多线程的优化，不同的是轻量级锁是通过CAS来避免开销较大的互斥操作，而偏向锁是在无资源竞争的情况下完全消除同步。

轻量级锁的“轻量”是相对于重量级锁而言的，它的性能会稍好一些。轻量级锁尝试利用CAS，在升级为重量级锁之前进行补救，目的是为了减少多线程进入互斥，当多个线程交替执行同步块时，jvm使用轻量级锁来保证同步，避免线程切换的开销，不会造成用户态与内核态的切换。但是如果过度自旋，会引起cpu资源的浪费，这种情况下轻量级锁消耗的资源可能反而会更多。

### 4 重量级锁

#### 4.1 Monitor 

重量级锁是依赖对象内部的monitor（监视器/管程）来实现的 ，而monitor 又依赖于操作系统底层的`Mutex Lock`（互斥锁）实现，这也就是为什么说重量级锁比较“重”的原因了，操作系统在实现线程之间的切换时，需要从用户态切换到内核态，成本非常高。在学习重量级锁的工作原理前，首先需要了解一下monitor中的核心概念：

- `owner`：标识拥有该`monitor`的线程，初始时和锁被释放后都为null
- `cxq (ConnectionList)`：竞争队列，所有竞争锁的线程都会首先被放入这个队列中
- `EntryList`：候选者列表，当`owner`解锁时会将`cxq`队列中的线程移动到该队列中
- `OnDeck`：在将线程从`cxq`移动到`EntryList`时，会指定某个线程为Ready状态（即`OnDeck`），表明它可以竞争锁，如果竞争成功那么称为`owner`线程，如果失败则放回`EntryList`中
- `WaitSet`：因为调用`wait()`或`wait(time)`方法而被阻塞的线程会被放在该队列中
- `count`：monitor的计数器，数值加1表示当前对象的锁被一个线程获取，线程释放monitor对象时减1
- `recursions`：线程重入次数

用图来表示线程竞争的的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dabd3ab6c960455688ef6f455ed4bcc0~tplv-k3u1fbpfcp-zoom-1.image)

当线程调用`wait()`方法，将释放当前持有的monitor，将`owner`置为null，进入`WaitSet`集合中等待被唤醒。当有线程调用`notify()`或`notifyAll()`方法时，也会释放持有的monitor，并唤醒`WaitSet`的线程重新参与monitor的竞争。

#### 4.2 重量级锁原理

当升级为重量级锁的情况下，锁对象的`mark word`中的指针不再指向线程栈中的`lock record`，而是指向堆中与锁对象关联的monitor对象。当多个线程同时访问同步代码时，这些线程会先尝试获取当前锁对象对应的monitor的所有权：

- 获取成功，判断当前线程是不是重入，如果是重入那么`recursions+1`
- 获取失败，当前线程会被阻塞，等待其他线程解锁后被唤醒，再次竞争锁对象

在重量级锁的情况下，加解锁的过程涉及到操作系统的`Mutex Lock`进行互斥操作，线程间的调度和线程的状态变更过程需要在用户态和核心态之间进行切换，会导致消耗大量的cpu资源，导致性能降低。

### 总结

在jdk1.6中，引入了偏向锁和轻量级锁，并使用锁升级机制对`synchronized`进行了充分的优化。其实除锁升级外，还使用了锁消除、锁粗化等优化手段，所以对它的认识要脱离“重量级”这一概念，不要再单纯的认为它的性能差了。在某些场景下，`synchronized`的性能甚至已经超过了`Lock`同步锁。

尽管java对`synchronized`做了这些优化，但是在使用过程中，我们还是要尽量减少锁的竞争，通过减小加锁粒度和减少同步代码的执行时间，来降低锁竞争，尽量使锁维持在偏向锁和轻量级锁的级别，避免升级为重量级锁，造成性能的损耗。

最后不得不再提一句，在java15中已经默认禁用了偏向锁，并弃用所有相关的命令行选项，虽然说不确定未来的LTS版本会怎样改动，但是了解一下偏向锁的基础也没什么不好的，毕竟你发任你发，我用java8~

