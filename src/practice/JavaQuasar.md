---
title: Java不支持协程？那是你不知道Quasar！
icon: page
order: 5
author: Hydra
date: 2022-02-16
tag:
  - 协程
  - Quasar
star: true
---



<!-- more -->

在编程语言的这个圈子里，各种语言之间的对比似乎就一直就没有停过，像什么古早时期的"**PHP是世界上最好的语言**"就不提了，最近我在摸鱼的时候，看到不少文章都在说"**Golang性能吊打Java**"。作为一个写了好几年java的javaer，这我怎么能忍？于是在网上看了一些对比golang和java的文章，其中戳中java痛点、也是golang被吹上天的一条，就是对多线程并发的支持了。先看一段描述：

> Go从语言层面原生支持并发，并且使用简单，Go语言中的并发基于轻量级线程`Goroutine`，创建成本很低，单个Go应用也可以充分利用CPU多核，编写高并发服务端软件简单，执行性能好，很多情况下完全不需要考虑锁机制以及由此带来的各种问题。

看到这，我的心瞬间凉了大半截，真的是字字扎心。虽然说java里的`JUC`包已经帮我们封装好了很多并发工具，但实际高并发的环境中我们还要考虑到各种锁的使用，以及服务器性能瓶颈、限流熔断等非常多方面的问题。

再说回go，前面提到的这个`goroutine`究竟是什么东西？其实，轻量级线程`goroutine`也可以被称为**协程**，得益于go中的调度器以及GMP模型，go程序会智能地将`goroutine`中的任务合理地分配给每个 CPU。

好了，其实上面说的这一大段我也不懂，都是向写go的哥们儿请教来的，总之就是go的并发性能非常优秀就是了。不过这都不是我们要说的重点，今天我们要讨论的是如何在Java中使用协程。

## 协程是什么？

我们知道，线程在阻塞状态和可运行状态的切换，以及线程间的上下文切换都会造成性能的损耗。为了解决这些问题，引入协程`coroutine`这一概念，就像在一个进程中允许存在多个线程，在一个线程中，也可以存在多个协程。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1900651ee17b46bf9d9885556835b4d1~tplv-k3u1fbpfcp-zoom-1.image)

那么，使用协程究竟有什么好处呢？

首先，执行效率高。线程的切换由操作系统内核执行，消耗资源较多。而协程由程序控制，在用户态执行，不需要从用户态切换到内核态，我们也可以理解为，协程是一种进程自身来调度任务的调度模式，因此协程间的切换开销远小于线程切换。

其次，节省资源。因为协程在本质上是通过分时复用了一个单线程，因此能够节省一定的资源。

类似于线程的五种状态切换，协程间也存在状态的切换，下面这张图展示了协程调度器内部任务的流转。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c9f1def37e2e41f7b9cef55645ef73e2~tplv-k3u1fbpfcp-zoom-1.image)

综合上面这些角度来看，和原生支持协程的go比起来，java在多线程并发上还真的是不堪一击。但是，虽然在Java官方的jdk中不能直接使用协程，但是，有其他的开源框架借助动态修改字节码的方式实现了协程，就比如我们接下来要学习的Quasar。

## Quasar使用

Quasar是一个开源的Java协程框架，通过利用`Java instrument`技术对字节码进行修改，使方法挂起前后可以保存和恢复jvm栈帧，方法内部已执行到的字节码位置也通过增加状态机的方式记录，在下次恢复执行可直接跳转至最新位置。

Quasar项目最后更新时间为2018年，版本停留在`0.8.0`，但是我在直接使用这个版本时报了一个错误：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4ab4271c898f4d17ab5651baace4c3c2~tplv-k3u1fbpfcp-zoom-1.image)

这个错误的大意就是这个class文件是使用的高版本jdk编译的，所以你在低版本的jdk上当然无法运行了。这里`major`版本号54对应的是`jdk10`，而我使用的是`jdk8`，无奈降级试了一下低版本，果然`0.7.10`可以使用：

```xml
<dependency>
    <groupId>co.paralleluniverse</groupId>
    <artifactId>quasar-core</artifactId>
    <version>0.7.10</version>
</dependency>
```

在我们做好准备工作后，下面就写几个例子来感受一下协程的魅力吧。

### 1、运行时间

下面我们模拟一个简单的场景，假设我们有一个任务，平均执行时间为1秒，分别测试一下使用线程和协程并发执行10000次需要消耗多少时间。

先通过线程进行调用，直接使用`Executors`线程池：

```java
public static void main(String[] args) throws InterruptedException {
    CountDownLatch countDownLatch=new CountDownLatch(10000);
    long start = System.currentTimeMillis();
    ExecutorService executor= Executors.newCachedThreadPool();
    for (int i = 0; i < 10000; i++) {
        executor.submit(() -> {
            try {
                TimeUnit.SECONDS.sleep(1);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            countDownLatch.countDown();
        });
    }
    countDownLatch.await();
    long end = System.currentTimeMillis();
    System.out.println("Thread use:"+(end-start)+" ms");
}
```

查看运行时间：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f902d70e199046cfb2703dbadb87aa31~tplv-k3u1fbpfcp-zoom-1.image)

好了，下面我们再用Quasar中的协程跑一下和上面相同的流程。这里我们要使用的是Quasar中的`Fiber`，它可以被翻译为**协程**或**纤程**，创建`Fiber`的类型主要可分为下面两类：

```java
public Fiber(String name, FiberScheduler scheduler, int stackSize, SuspendableRunnable target);
public Fiber(String name, FiberScheduler scheduler, int stackSize, SuspendableCallable<V> target);
```

在`Fiber`中可以运行无返回值的`SuspendableRunnable`或有返回值的`SuspendableCallable`，看这个名字也知道区别就是java中的`Runnable`和`Callable`的区别了。其余参数都可以省略，`name`为协程的名称，`scheduler`是调度器，默认使用`FiberForkJoinScheduler`，`stackSize`指定用于保存fiber调用栈信息的`stack`大小。

在下面的代码中，使用了`Fiber.sleep()`方法进行协程的休眠，和`Thread.sleep()`非常类似。

```java
public static void main(String[] args) throws InterruptedException {
    CountDownLatch countDownLatch=new CountDownLatch(10000);
    long start = System.currentTimeMillis();

    for (int i = 0; i < 10000; i++) {
        new Fiber<>(new SuspendableRunnable(){
            @Override
            public Integer run() throws SuspendExecution, InterruptedException {
                Fiber.sleep(1000);
                countDownLatch.countDown();
            }
        }).start();
    }

    countDownLatch.await();
    long end = System.currentTimeMillis();
    System.out.println("Fiber use:"+(end-start)+" ms");
}
```

直接运行，报了一个警告：

```
QUASAR WARNING: Quasar Java Agent isn't running. If you're using another instrumentation method you can ignore this message; otherwise, please refer to the Getting Started section in the Quasar documentation.
```

还记得我们前面说过的Quasar生效的原理是基于`Java instrument`技术吗，所以这里需要给它添加一个代理Agent。找到本地maven仓库中已经下好的jar包，在`VM options`中添加参数：

```cmd
-javaagent:E:\Apache\maven-repository\co\paralleluniverse\quasar-core\0.7.10\quasar-core-0.7.10.jar
```

这次运行时就没有提示警告了，查看一下运行时间：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/290522765b964d99ba069368e5c5d858~tplv-k3u1fbpfcp-zoom-1.image)

运行时间只有使用线程池时的一半多一点，确实能大大缩短程序的效率。

### 2、内存占用

在测试完运行时间后，我们再来测试一下运行内存占用的对比。通过下面代码尝试在本地启动100万个线程：

```java
public static void main(String[] args) {
    for (int i = 0; i < 1000000; i++) {
        new Thread(() -> {
            try {
                Thread.sleep(100000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }).start();
    }
}
```

本来以为会报`OutOfMemoryError`，但是没想到的是我的电脑直接直接卡死了…而且不是一次，试了几次都是以卡死只能重启电脑而结束。好吧，我选择放弃，那么下面再试试启动100万个`Fiber`协程。

```java
public static void main(String[] args) throws Exception {
    CountDownLatch countDownLatch=new CountDownLatch(10000);
    for (int i = 0; i < 1000000; i++) {
        int finalI = i;
        new Fiber<>((SuspendableCallable<Integer>)()->{
            Fiber.sleep(100000);
            countDownLatch.countDown();
            return finalI;
        }).start();
    }
    countDownLatch.await();
    System.out.println("end");
}
```

程序能够正常执行结束，看样子使用的内存真的比线程少很多。上面我故意使每个协程结束的时间拖得很长，这样我们就可以在运行过程中使用Java VisualVM查看内存的占用情况了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/01e3b14081c54059b72e0e3e2edd05c7~tplv-k3u1fbpfcp-zoom-1.image)

可以看到在使用`Fiber`的情况下只使用了1G多一点的内存，平均到100万个协程上也就是说每个`Fiber`只占用了`1Kb`左右的内存空间，和`Thread`线程比起来真的是非常的轻量级。

从上面这张图中我们也可以看到，运行了非常多的`ForkJoinPool`，它们又起到了什么作用呢？我们在前面说过，协程是由程序控制在用户态进行切换，而Quasar中的调度器就使用了一个或多个`ForkJoinPool`来完成对`Fiber`的调度。

### 3、原理与应用

这里简单介绍一下Quasar的原理，在编译时框架会对代码进行扫描，如果方法带有`@Suspendable`注解，或抛出了`SuspendExecution`，或在配置文件`META-INF/suspendables`中指定该方法，那么Quasar就会修改生成的字节码，在`park`挂起方法的前后，插入一些字节码。

这些字节码会记录此时协程的执行状态，例如相关的局部变量与操作数栈，然后通过抛出异常的方式将cpu的控制权从当前协程交回到控制器，此时控制器可以再调度另外一个协程运行，并通过之前插入的那些字节码恢复当前协程的执行状态，使程序能继续正常执行。

回头看一下前面例子中的`SuspendableRunnable`和`SuspendableCallable`，它们的`run`方法上都抛出了`SuspendExecution`，其实这并不是一个真正的异常，仅作为识别挂起方法的声明，在实际运行中不会抛出。当我们创建了一个`Fiber`，并在其中调用了其他方法时，如果想要Quasar的调度器能够介入，那么必须在使用时层层抛出这个异常或添加注解。

看一下简单的代码书写的示例：

```java
public void request(){
    new Fiber<>(new SuspendableRunnable() {
        @Override
        public void run() throws SuspendExecution, InterruptedException {
            String content = sendRequest();
            System.out.println(content);
        }
    }).start();
}

private String sendRequest() throws SuspendExecution {
    return realSendRequest();
}

private String realSendRequest() throws SuspendExecution{
    HttpResponse response = HttpRequest.get("http://127.0.0.1:6879/name").execute();
    String content = response.body();
    return content;
}
```

需要注意的是，如果在方法内部已经通过try/catch的方式捕获了`Exception`，也应该再次手动抛出这个`SuspendExecution`异常。

## 总结

本文介绍了Quasar框架的简单使用，其具体的实现原理比较复杂，暂时就不在这里进行讨论，后面打算单独拎出来进行分析。另外，目前已经有不少其他的框架中已经集成了Quasar，例如同样是`Parallel Universe`下的Comsat项目，能够提供了HTTP和DB访问等功能。

虽然现在想要在Java中使用协程还只能使用这样的第三方的框架，但是也不必灰心，在OpenJDK 16中已经加入了一个名为`Project Loom`的项目， 在`OpenJDK Wiki`上可以看到对它的介绍，它将使用`Fiber`轻量级用户模式线程，从jvm层面对多线程技术进行彻底的改变，使用新的编程模型，使轻量级线程的并发也能够适用于高吞吐量的业务场景。

Quasar和Loom的相关的文档放在下面，有兴趣的小伙伴们可以自己看一下。

> Quasar git：https://github.com/puniverse/quasar
>
> Quasar api：http://docs.paralleluniverse.co/quasar/javadoc/
>
> OpenJdk Wiki：https://wiki.openjdk.java.net/display/loom/Main