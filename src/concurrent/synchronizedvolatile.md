---
title: 并发编程基础盘点-synchronized与volatile
icon: page
order: 2
author: Hydra
date: 2020-04-26
tag:
  - 并发
  - synchronized
  - volatile
star: true
---



<!-- more -->



在Java并发编程中，`synchronized`和`volatile`是两个非常重要的关键字，它们可以用来控制并发中的互斥性与可见性，本文我们先来看看在并发环境下，`synchronized`应该如何使用，以及它能够如何保证互斥性与可见性。

在正式开始之前，我们首先来看一下互斥性和可见性的概念：

- 互斥性：即在同一时间只允许一个线程持有某个对象锁，通过这种特性来实现多线程中的协调机制，这样在同一时间只有一个线程对需同步的代码块(复合操作)进行访问。互斥性我们也往往称为操作的原子性。
- 可见性：必须确保在锁被释放之前，对共享变量所做的修改，对于随后获得该锁的另一个线程是可见的（即在获得锁时应获得最新共享变量的值），否则另一个线程可能是在本地缓存的某个副本上继续操作从而引起不一致。

## synchronized

我们知道`synchronized`关键字是用来控制线程同步的，在多线程的环境下，使用`synchronized`能够控制代码不被多个线程同时执行，来看看它的具体使用。

### 1、同步非静态方法

被修饰的方法称为同步方法，这时的锁是当前类的实例对象。

**a、多个线程访问相同对象的相同`synchronized`方法：**

```java
public class SynchronizedDemo1 {
    public synchronized  void access() {
        try {
            System.out.println(Thread.currentThread().getName()+" start");
            TimeUnit.SECONDS.sleep(2);
            System.out.println(Thread.currentThread().getName()+" end");
        }catch (Exception e){
            e.printStackTrace();
        }
    }
    public static void main(String[] args) {
        SynchronizedDemo1 demo01=new SynchronizedDemo1();
        for(int i=0;i<5;i++){
            new Thread(demo01::access).start();
        }
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a6becd6e64a432aa58e78b3adf28d96~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，当多个线程对同一个对象的同步方法进行操作时，只有一个线程能够抢到锁。在一个线程获取了该对象的锁后，其他的线程无法获取该对象的锁，需要等待线程先把这个锁释放掉才能访问同步方法。

**b、 多个线程访问相同对象的不同synchronized方法：**

```java
public class SynchronizedDemo2 {
    public synchronized void access1() {
        try {
            System.out.println(Thread.currentThread().getName()+" in access1 start");
            TimeUnit.SECONDS.sleep(5);
            System.out.println(Thread.currentThread().getName()+" in access1 end");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    public synchronized void access2() {
        try {
            System.out.println(Thread.currentThread().getName()+" in access1 start");
            TimeUnit.SECONDS.sleep(5);
            System.out.println(Thread.currentThread().getName()+" in access1 end");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    public static void main(String[] args) {
        SynchronizedDemo2 test = new SynchronizedDemo2();
        new Thread(test::access1).start();
        new Thread(test::access2).start();
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bb97124382bd4957bc9eb3f5a46b3bbc~tplv-k3u1fbpfcp-zoom-1.image)

由此可以确认，当线程访问`synchronized`修饰的任意方法时，如果当前对象被其他线程加锁，都需要等待其他线程先把当前的对象锁释放掉。

**c、 多个不同对象的线程访问synchronized方法：**

```java
public class SynchronizedDemo3 {
    public synchronized void access1() {
        try {
            System.out.println(Thread.currentThread().getName()+" start");
            TimeUnit.SECONDS.sleep(5);
            System.out.println(Thread.currentThread().getName()+" end");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    public static void main(String[] args) {
        final SynchronizedDemo3 test1 = new SynchronizedDemo3();
        final SynchronizedDemo3 test2 = new SynchronizedDemo3();
        new Thread(test1::access1).start();
        new Thread(test2::access1).start();
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2f0eba188b0b429f8819907a8b7ab8ca~tplv-k3u1fbpfcp-zoom-1.image)

可以看出两个线程同时开始执行，这时因为两个线程属于不同的对象，而锁住的是类产生的实例对象，两个线程就获得了不同的锁。因此，不同对象产生的线程可以同时访问`synchronized`方法。

### 2、同步静态方法

静态方法是属于类的而不属于对象的 ，所以同样的， `synchronized`修饰的静态方法锁定的是这个类的`class`对象 。

```java
public class SynchronizedDemo4 {
    public synchronized static void access() {
        try {
            System.out.println(Thread.currentThread().getName()+"  start");
            TimeUnit.SECONDS.sleep(2);
            System.out.println(Thread.currentThread().getName()+"  end");
        }catch (Exception e){
            e.printStackTrace();
        }
    }
    public static void main(String[] args) {
        for(int i=0;i<5;i++){
            new Thread(SynchronizedDemo4::access).start();
        }
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/980674d538af4db7a1171926ee279411~tplv-k3u1fbpfcp-zoom-1.image)

分析可知，当`synchronized`修饰静态方法时，线程之间也发生了互斥，当一个线程访问同步方法时，其他线程必须等待。因为当`synchronized`修饰静态方法时，锁是`class`对象，而不是类的实例对象。

### 3、同步代码块

被修饰的代码块称为同步代码块，其作用的范围是大括号括起来的代码，这时锁是括号中的对象。

那么为什么要使用同步代码块呢？在方法比较长，而需要同步的代码只有一小部分时，如果对整段方法进行同步操作，可能会造成等待时间过长。这时我们可以使用同步代码块对需要同步的代码进行包围，而无需对整个方法进行同步。

根据锁的对象不同，又可以分为以下两类：

**a、以对象作为锁：**

使用实例对象作为锁，即线程需要进入被`synchronized`的代码块时，必须持有该对象锁，而后来的线程则必须等待该对象的释放。

```java
//以this为例
public void accessResources() {
    synchronized (this) {
        try {
            TimeUnit.SECONDS.sleep(2);
            System.out.println(Thread.currentThread().getName() + "  is running");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

此处，因为`this`指的是当前对象，所以不能用在`static`方法上。

**b、使用类的class对象作为锁：**

```java
public void accessResources() {
    synchronized (SynchroDemo5.class) {
        try {
            TimeUnit.SECONDS.sleep(2);
            System.out.println(Thread.currentThread().getName() + "  is running");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

public static void main(String[] args) {
    final SynchroDemo5 demo5 = new SynchroDemo5();
    for (int i = 0; i < 5; i++) {
        new Thread(demo5::accessResources).start();
    }
}
```

此时，有该`class`对象的所有的对象都共同使用这一个锁。

在当没有明确的对象作为锁时，只是想让一段代码同步时，则可以创建一个特殊的对象来充当锁，例如创建一个`Object`对象。

```java
private final Object MUTEX =new Object();
public void methodName(){
   Synchronized(MUTEX ){
     //TODO
   }
}
```

看完了实现，那么`synchronized`底层的实现原理是怎样的呢？我们分同步代码块与同步方法来。

### 原理

反编译使用同步代码块的类生成的class文件：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e11182452fd74a329cf92a2bd301410f~tplv-k3u1fbpfcp-zoom-1.image)

这里使用了`monitorenter`和`monitorexit`对进入同步代码进行了控制。

#### monitorenter ：

每个对象有一个监视器锁（`monitor`）。当`monitor`被占用时就会处于锁定状态，线程执行`monitorenter`指令时尝试获取`monitor`的所有权，过程如下：

- 如果`monitor`的进入数为0，则该线程进入`monitor`，然后将进入数设置为1，该线程即为`monitor`的所有
- 如果线程已经占有该`monitor`，只是重新进入，则进入`monitor`的进入数加1
- 如果其他线程已经占用了`monitor`，则该线程进入阻塞状态，直到`monitor`的进入数为0，再重新尝试获取`monitor`的所有权。

#### monitorexit:

执行`monitorexit`的线程必须是`monitor`的持有者。指令执行时，`monitor`的进入数减1，如果减1后进入数为0，那线程退出`monitor`，不再是这个`monitor`的所有者，其他被这个`monitor`阻塞的线程可以尝试去获取这个` monitor `的所有权。

反编译使用同步方法的类生成的class文件：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a601242c49134138a1d1def90b71ed76~tplv-k3u1fbpfcp-zoom-1.image)

方法的同步并没有通过指令`monitorenter`和`monitorexit`来完成，相对于普通方法，其常量池中多了`ACC_SYNCHRONIZED`标识符。JVM就是根据该标示符来实现方法的同步的：当方法调用时，调用指令将会检查方法的` ACC_SYNCHRONIZED `访问标志是否被设置，如果设置了，执行线程将先获取`monitor`，获取成功之后才能执行方法体，方法执行完后再释放`monitor`。在方法执行期间，其他任何线程都无法再获得同一个`monitor`对象。其实本质上没有区别，只是方法的同步是一种隐式的方式来实现，无需通过字节码来完成。

## volatile

下面我们再来看看在并发编程中另一个非常重要的关键字`volatile`。

为了直观的体会`volatile`的作用，下面先看一段代码：

```java
public class VolatileTest {
    private static boolean flag=false;

    public void setFlag(){
        this.flag=true;
        System.out.println(Thread.currentThread().getName()+" change flag to true");
    }

    public void getFlag(){
        while(!flag){
        }
        System.out.println(Thread.currentThread().getName()+" get flag status change to true");
    }

    public static void main(String[] args) {
        VolatileTest test=new VolatileTest();
        new Thread(test::getFlag).start();
        
        try {
            TimeUnit.SECONDS.sleep(3);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        
        new Thread(test::setFlag).start();
    }
}
```

例子中使用两个线程来对`boolean`类型的flag进行修改和读取。讲道理当执行`getFlag`方法的线程检测到flag变为`true`时，应该退出循环并打印语句。但是看一下执行结果，会发现只打印了`setFlag`方法中的语句，并且程序一直没有执行结束。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7ca9f114ee21403c883d6860d1678c94~tplv-k3u1fbpfcp-zoom-1.image)

下面，我们在flag加上`volatile`关键字修饰，再执行一次上面的代码：

```java
 private static volatile boolean flag=false;
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/230b1f0138aa44908425ab1f8ae7d34c~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，这时`getFlag`方法的线程检测到了flag的变化，并正常结束了程序。结合上面的例子，我们发现，当一个线程写数据，另一个线程读数据时，会存在**数据不一致性**的问题，而`volatile`的出现正好解决了这个问题。那么`volatile`究竟做了什么工作呢，这个时候就要引入java内存模型（`JMM`）来一探究竟了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/89171f5ca4644d749998d6e40dd9bfe2~tplv-k3u1fbpfcp-zoom-1.image)

如上图中所示，java中运行的线程是不能直接读写主内存的变量，而是只能操作自己工作内存中的变量，然后再同步到主内存中。主内存是多个线程共享的，单线程间不共享工作内存，如果线程间需要通信，必须借助主内存中转来完成。

JMM控制中，又将对数据原子操作分为以下8个类别：

- `read`（读取）：从主内存读取数据
- `load`（载入）：将主内存读取的数据写入工作内存
- `use`（使用）：从工作内存读取数值来计算
- `assign`（赋值）：将计算好的值重新赋值到工作内存中
- `store`（存储）：将工作内存数据写入主内存
- `write`（写入）：将`store`过去的变量值赋值给主内存中的变量
- `lock`（锁定）：将主内存变量加锁，标识为线程独占状态
- `unlock`（解锁）：将主内存变量解锁，解锁后其他线程可以锁定该变量

那么，我们之前举的例子就可以用下面的图来表示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/62c022c8c8114728a23277706e5d7b07~tplv-k3u1fbpfcp-zoom-1.image)

很明显，线程1无法跳出循环的原因是它读取的一直是自己工作内存中的flag，而没有获取到主内存中更新后的值。

为了解决缓存一致性问题，曾经使用过**总线加锁**的解决方案。具体来说，就是CPU从主内存读取数据到缓存，会在总线上进行数据加锁，这样其他CPU就没法去读写这个数据，直到这个CPU使用完数据释放锁之后其他CPU才能读取该数据。

但是这样一来，由于加锁的粒度太大，会造成阻塞时间过长，严重降低CPU的使用性能。因此在此基础上，行成了我们现在使用的**MESI缓存一致性协议：**

简单来说，就是多个CPU从主内存读取同一个数据到各自的缓存，当其中某个CPU修改了缓存里的数据，该数据会马上同步回主内存，其他CPU通过总线嗅探机制可以感知到数据的变化而将自己缓存里的数据失效。

总结一下，就是在读操作时，不做任何事情，把内存中的数据读到缓存中。而在写操作时，发出信号通知其他的CPU将该变量置为无效，其他的CPU要访问这个变量的时候，只能从内存中获取。

给测试类配置启动参数，打印汇编指令到控制台：

```java
-server -Xcomp -XX:+UnlockDiagnosticVMOptions 
-XX:+PrintAssembly 
-XX:CompileCommand=compileonly,*VolatileTest.setFlag
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e5f86f27f51e40c7831658c19e34fff3~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，在执行到修改flag的语句时，首先加入`lock`这一个前缀指令，实现了对缓存行的锁定。简单来说，就是：

```java
lock
flag=true write回主内存
unlock
```

只有在执行写`write`操作时候才会加锁，相对总线对数据加锁，极大的降低了锁的粒度，只要不是在`write`过程中其他线程依然可以读取主内存中的数据，从而提高了CPU性能

除此之外，`volatile`还能够实现指令的**有序性**。保证有序性是因为有时候会出现代码实际执行的顺序并不是我们输入的代码的顺序，那么为什么会出现这种情况呢，这里就有必要引入一下**指令重排序**：编译器为了优化程序的性能，会重新对字节码指令排序。

指令重排序的基础是，编译器认为运行的结果一定是正常的。在单线程下，指令重排序对程序的帮助一定是正向的，可以很好的优化程序的性能，但是在多线程下，有可能因为指令重排序出现一些问题。`volatile`实现有序性保证了以下两点：

- `volatile`之前的代码不能调整到它的后面
- `volatile`之后的代码不能调整到它的前面

## 总结

最后，总结一下`synchronized`与`volatile`的特点以及区别：

- 使用上的区别：`volatile`只能修饰变量，`synchronized`能修饰方法和语句块
- 对原子性的保证：`synchronized`可以保证原子性，`volatile`不能保证原子性
- 对可见性的保证：都可以保证可见性，但实现原理不同。`volatile`对变量加了`lock`，`synchronized`使用`monitorenter`和`monitorexit`
- 对有序性的保证：`volatile`能保证有序，`synchronized`虽然也可以保证有序性，但是代价变大（重量级），并发退化到串行执行
- 除此之外：`synchronized`会引起阻塞，而`volatile`则不会引起阻塞

