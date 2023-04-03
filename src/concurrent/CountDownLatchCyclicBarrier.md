---
title: CountDownLatch&CyclicBarrier
icon: page
order: 5
author: Hydra
date: 2020-08-16
tag:
  - CountDownLatch
  - CyclicBarrier
  - 并发
star: true
---



<!-- more -->

`CountDownLatch`和`CyclicBarrier`作为juc工具包下的同步控制工具类，在我们工作中频繁使用。它们的功能具有相似之处，同时也有一定的区别。本文我们结合具体代码实例对两者的使用与差异进行分析。

## CountDownLatch

`CountDownLatch`可以看作一个计数器，并且这个计数器的操作是原子操作，同时只能有一个线程去操作这个计数器，也就是同时只能有一个线程去减这个计数器里面的值。先看一下常用的几个重要方法，首先看构造方法：

```java
CountDownLatch countDownLatch=new CountDownLatch(count);
```

构造器中传入的`count`为`int`类型，这个计数器的初始值就是需要等待的线程数量。这个值只能被设置一次，并且`CountDownLatch`不提供任何方法去修改或重置这个值。

`countDown`方法：

```java
countDownLatch.countDown();
```

每当一个线程完成了自己的任务后，调用该方法，计数器的值减1。当计数器的值为0时，表示所有线程都已经完成了任务，然后在锁上等待的线程就可以恢复执行任务。

`await`方法：

```
countDownLatch.await();
```

一般主线程在启动其他线程后调用该方法，这样主线程的操作就会在这个方法上阻塞，直到其他线程完成各自的任务。一般而言，与`CountDownLatch`的第一次交互就是在这里，主线程等待其他线程。

下面以一个例子来看一下具体的使用：假设我们通过第三方机构查询机票，第三方会分别去统计各个航空公司的现存票数，查询全部完成后再返回结果。主线程：

```java
public class CountDownDemo {
    private static List<String> company= Arrays.asList("山航","东航","青航");
    private static List<String> flightList=new ArrayList<>();

    public static void main(String[] args) throws InterruptedException {
        CountDownLatch countDownLatch=new CountDownLatch(company.size());
        for (int i = 0; i < company.size(); i++) {
            String name=company.get(i);
            QueryThread queryThread=new QueryThread(countDownLatch,flightList,name);
            new Thread(queryThread).start();
        }
        countDownLatch.await();
        System.out.println("===查询结束===");
        flightList.forEach(System.out::println);
    }
}
```

查询线程：

```java
public class QueryThread implements Runnable{
    private CountDownLatch countDownLatch;
    private List<String> fightList=new ArrayList<>();
    private String name;

    public QueryThread(CountDownLatch countDownLatch,List<String> fightList, String name) {
        this.countDownLatch = countDownLatch;
        this.fightList=fightList;
        this.name = name;
    }

    @Override
    public void run() {
        int val=new Random().nextInt(10);
        try {
            System.out.printf("%s开始查询！\n",name);
            TimeUnit.SECONDS.sleep(val);
            fightList.add(name+"票数："+val);
            System.out.printf("%s查询成功！\n",name);
            countDownLatch.countDown();
        }catch (Exception e){
            e.printStackTrace();
        }
    }
}
```

执行代码：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7fb3adcd15bb49c782e1b39106950b1d~tplv-k3u1fbpfcp-zoom-1.image)

从执行结果可以看出，在3个查询线程均完成查询后，唤醒主线程，返回了最终数据。

通过这个例子，我们可以得出，如果一个接口依赖了多个第三方服务或外部接口，那么如果串行调用的话执行时间必然很长，这时候就可以使用`CountDownLatch`进行并行调用，这一点的思路也比较像使用消息队列对上下游系统进行解耦的过程。

## CyclicBarrier

`CyclicBarrier`可以被翻译为“循环栅栏”，通过它可以实现让一组线程等待至某个状态之后再同步执行。“循环”这一点体现在当所有的等待线程都被释放后，`CyclicBarrier`可以被重用。

执行的基本原理是，当线程调用了`CyclicBarrier`的`await()`方法后，就会处于一个`barrier`的状态，也就是遇到了一个屏障。如果所有线程都执行到这个状态，那么这个屏障就会打开，使所有线程继续向下执行。

先看一下常用的几个重要方法，首先看构造方法：

```
CyclicBarrier barrier=new CyclicBarrier(parties);
```

这里的parties就是参与线程的个数。

`await()`方法：

```
barrier.await();
```

线程调用该方法表示自己已经到达栅栏。

以5名选手进行赛跑为例，这个过程必须要等到所有运动员到达起跑线才开始正式比赛，正好符合`CyclicBarrier`的思想。

```java
public class CyclicBarrierDemo {
    public static void main(String[] args) {
        CyclicBarrier barrier=new CyclicBarrier(5);
        Thread[] player=new Thread[5];
        for (int i = 0; i <5 ; i++) {
            player[i]=new Thread(()->{
                try {
                    TimeUnit.SECONDS.sleep(new Random().nextInt(10));
                    System.out.println(Thread.currentThread().getName()+" is ready");
                    barrier.await();
                } catch (Exception e) {
                    e.printStackTrace();
                }
                System.out.println(Thread.currentThread().getName()+" start running");
            },"player["+i+"]");
            player[i].start();
        }
    }
}
```

执行代码：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c2105700f6e943bd8e2a71e60906ee4a~tplv-k3u1fbpfcp-zoom-1.image)

从执行结果可以看出，在5个线程都执行完`await`方法后，继续各自执行之后的代码。

## 总结

`CountDownLatch`和`CyclicBarrier`都有让多个线程等待同步然后再开始下一步动作的意思，但他们还是存在以下几点区别：

- `CountDownLatch`需要线程自己调用`countDown()`方法减少一个计数，然后等所有完成后调用`await()`方法；而`CyclicBarrier`则直接调用`await()`方法等待即可
- `CountDownLatch`对应数值减一；`CyclicBarrier`对应数值加一
- `CountDownLatch`更倾向于多个线程合作的情况，等所有东西都准备好了，等待的阻塞线程就自动执行；`而CyclicBarrier`则是所有线程都在一个地方阻塞，等到所有线程就绪，一起执行
- `CountDownLatch`的下一步的动作的执行者是主线程；而`CyclicBarrier`的下一步动作的执行者还是各个子线程
- `CountDownLatch`具有不可重复性；`CyclicBarrier`具有往复多次实施动作的特点，可以循环使用