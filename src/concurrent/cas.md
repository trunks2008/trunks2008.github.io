---
title: 并发编程基础盘点 - CAS
icon: page
order: 4
author: Hydra
date: 2020-05-09
tag:
  - 并发
  - CAS
star: true
---



<!-- more -->

CAS（`Compare and Swap`），中文可以理解为比较并替换，是一种实现并发算法时常用到的技术。它是一种无锁原子算法，是一种乐观锁的实现方式，在操作时是抱着乐观的态度进行的，它总是认为可以成功完成操作。

## CAS思路

让我们先直观的理解一下CAS的大体思路：

```java
CAS（V，E，N）
```

它包含 3 个参数，V表示要更新变量的值，E表示预期值，N表示新值。仅当 V值等于E值时，才会将V的值设为N，如果V值和E值不同，则说明已经有其他线程做过更新，则当前线程则什么都不做。最后，CAS 返回当前V的真实值。

先从一个简单例子开始：

```java
public class CasTest0 {
    private static volatile int m = 0;
    public static void increase1() {
        m++;
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 1000; i++) {
           new Thread(() -> {
                CasTest0.increase1();
            }).start();
        }
        TimeUnit.SECONDS.sleep(3);
        System.out.println(m);
    }
}
public class CasTest0 {
    private static volatile int m = 0;
    public static void increase1() {
        m++;
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 1000; i++) {
           new Thread(() -> {
                CasTest0.increase1();
            }).start();
        }
        TimeUnit.SECONDS.sleep(3);
        System.out.println(m);
    }
}
```

运行这个例子，最后打印出的值可能是任意小于1000的正整数。在之前的文章中讲过，`volatile`可以保证可见性和有序性，但是无法保证原子性。而`m++`这一操作又不是原子操作，可以分为三个步骤：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f57b2d6b3f15433ebb3943ab539f9429~tplv-k3u1fbpfcp-zoom-1.image)

- 获取静态变量m的值并入栈，int型常量值1入栈
- 栈顶int型数值相加，并将结果压入栈顶
- 为静态变量m赋值

从上述分析可得，自增操作并不具有原子性，所以在多线程环境下，运行得到的结果必定小于等于1000。

## JUC中的CAS实现

接下来，换成JUC包下的**原子类操作**试一下：

```java
public class CasTest1 {
    private static AtomicInteger atomicI = new AtomicInteger(0);  
    public static void increase2() {
        atomicI.incrementAndGet(); 
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> {
                CasTest1.increase2();
            }).start();
        }
        TimeUnit.SECONDS.sleep(3);
        System.out.println(atomicI.get());
    }
}
public class CasTest1 {
    private static AtomicInteger atomicI = new AtomicInteger(0);  
    public static void increase2() {
        atomicI.incrementAndGet(); 
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> {
                CasTest1.increase2();
            }).start();
        }
        TimeUnit.SECONDS.sleep(3);
        System.out.println(atomicI.get());
    }
}
```

这样运行结果会始终返回1000，这就取决于原子Integer类`AtomicInteger`发挥了作用。反编译看一下实际执行的指定，这里是仅以一条指令完成了自增的操作

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14612da4417840c78bc0cf54bbce51db~tplv-k3u1fbpfcp-zoom-1.image)

看一下`AtomicInteger`类的实现：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ced091f66fe84a39a3cbd7a6671c59ec~tplv-k3u1fbpfcp-zoom-1.image)

在`AtomicInteger`中使用了`Unsafe`类，这个类可以说是java提供的一个后门类，可以用来直接操作内存地址。（针对Unsafe，以前写过一篇专门的文章，大家如果有需求可以看一下[Java双刃剑之Unsafe类详解](https://juejin.cn/post/6956754202399866888)）

代码中的变量表示的意义如下：

- `valueOffset`：变量value的地址偏移量，具体赋值是在下面的静态代码块中进行的
- `value`：需要修改的值，相当于i++操作中的i

`incrementAndGet`最终调用`Unsafe`类中的方法：

```java
//获取内存地址为obj+offset的变量值, 并将该变量值加上delta
public final int getAndAddInt(Object obj, long offset, int delta) {
    int v;
    do {
        //通过对象和偏移量获取变量的值
        //由于volatile的修饰, 所有线程看到的v都是一样的
        v= this.getIntVolatile(obj, offset);
    } while(!this.compareAndSwapInt(obj, offset, v, v + delta));
    return v;
}
```

具体流程：

- while循环中的`compareAndSwapInt()`方法尝试修改v的值， 该方法会通过`obj`和`offset`获取变量的值
- 如果这个值和v不一样，说明其他线程修改了`obj+offset`地址处的值，此时`compareAndSwapInt()`返回false，继续循环
- 如果这个值和v一样，说明没有其他线程修改`obj+offset`地址处的值，此时可以将`obj+offset`地址处的值改为`v+delta`， `compareAndSwapInt()`返回true，退出循环

`compareAndSwapInt`是一个`native`方法，调用了c++中的方法，后续调用链为调用汇编中的`cmpxchg`指令，最终通过二进制硬件支持实现了这一原子操作。

那么，CAS都有什么应用场景呢？典型场景就是电商中对于货物的库存的管理。首先从数据库中读取库存，在卖出货物后更新库存时，判断库存数量是否还和自己取出时相同，如果相同则更新，不同则进行自旋直到执行成功。

## ABA问题

说了这么多，那么CAS就是完美的吗，很遗憾并不是，CAS仍然存在经典的**ABA问题**：

按照我们之前的理解，CAS需要检查操作值有没有发生改变，如果没有发生改变则更新。但是存在这样一种情况：如果一个值原来是A，变成了B，然后又变成了A，那么在CAS检查的时候会发现没有改变，但是实质上它已经发生了改变，这就是所谓的ABA问题。

```java
public class CasTest2 {
    private static AtomicInteger atomicI = new AtomicInteger(100);

    public static void main(String[] args) throws Exception {
        Thread t1 = new Thread(() -> {
            System.out.println(Thread.currentThread().getName()+":"+atomicI.compareAndSet(100, 110));
        },"thread1");
        t1.start();

        Thread t2 = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TimeUnit.SECONDS.sleep(1);
                    System.out.println(Thread.currentThread().getName()+":"+atomicI.compareAndSet(110, 100));
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        },"thread2");
        t2.start();

        Thread t3 = new Thread(() -> {
            try {
                TimeUnit.SECONDS.sleep(3);
                System.out.println(Thread.currentThread().getName()+":"+atomicI.compareAndSet(100, 90));
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        },"thread3");
        t3.start();
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/430d2ed16ac8492999c5bd8cf1b351fd~tplv-k3u1fbpfcp-zoom-1.image)

三个线程的运行结果都为true，但是thread3执行时候检查的值是已经被中途修改过的，而不是初始值了。

应对ABA问题，其解决方案是加上版本号，即在每个变量都加上一个版本号，每次改变时加1。

```
即将原来的：A —> B —> A

变成：1A —> 2B —> 3A
```

这里引入`AtomicStampedReference`这个类，它内部不仅维护了对象值，还维护了一个int类型的`stamp`值，可以将其理解为时间戳或版本号。当`AtomicStampedReference`对应的数值被修改时，除了更新数据本身外，还必须要更新这个`stamp`的值。并且当`AtomicStampedReference`设置对象值时，对象值以及`stamp`值都必须满足期望，写入才会成功。因此，即使对象值被反复读写，写回原值，只要`stamp`的值发生变化，就能防止不恰当的写入。

```java
public class CasTest3 {
    private static AtomicStampedReference asr = new AtomicStampedReference(100, 1);
    public static void main(String[] args) throws Exception {
        Thread t1 = new Thread(() -> {
            try {
                TimeUnit.SECONDS.sleep(2);
            } catch (Exception e) {
                e.printStackTrace();
            }
            System.out.println("1:" + asr.compareAndSet(100, 110, asr.getStamp(), asr.getStamp() + 1) );
            System.out.println("stamp:"+asr.getStamp()+"  value:"+asr.getReference());
            System.out.println("2:" + asr.compareAndSet(110, 100, asr.getStamp(), asr.getStamp() + 1) );
            System.out.println("stamp:"+asr.getStamp()+"  value:"+asr.getReference());
        });

        Thread t2 = new Thread(() -> {
            int stamp = asr.getStamp();
            try {
                TimeUnit.SECONDS.sleep(4);
            } catch (Exception e) {
                e.printStackTrace();
            }
            System.out.println("3:" + asr.compareAndSet(100, 110, stamp, stamp + 1) );
            System.out.println("stamp:"+asr.getStamp()+"  value:"+asr.getReference());
        });

        t1.start();
        t2.start();
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c0e7a2e5a7d14784b8f568ec6f7cdeda~tplv-k3u1fbpfcp-zoom-1.image)

Thread2期待的`stamp`值为1，Reference的值为100。Thread1在每次自增的同时，`stamp`值加1，所以在经过Thread1两次修改Reference值后，即使与期望的Reference值相同，但`stamp`值不同，仍然不做任何修改。

## CAS缺点

最后对CAS的缺点进行一下总结，CAS虽然高效地解决了原子操作问题，但是还是存在一些缺陷的，主要表现在三个方面：

- 循环时间太长：如果CAS一直不成功的情况发生，会一直进行自旋操作，会造成大量CPU执行开销。在JUC中有些地方就限制了CAS自旋的次数，例如`BlockingQueue`的`SynchronousQueue`
- 只能保证一个共享变量原子操作：看了CAS的实现过程，可以得出CAS只能针对一个共享变量，如果是多个共享变量情况，只能使用锁来保证原子性了
- ABA问题：CAS需要检查操作值有没有发生改变，如果没有发生改变则更新，但是之前提到的ABA问题会造成一定影响，这时只要加上版本号对其进行限定就可以了