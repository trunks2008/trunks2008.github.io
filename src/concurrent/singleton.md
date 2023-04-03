---
title: 并发编程基础盘点 - 单例模式
icon: page
order: 3
author: Hydra
date: 2020-05-02
tag:
  - 单例模式
  - 并发
star: true
---



<!-- more -->

单例模式是一种常见的设计模式，在这个模式下，单例对象的类必须保证只有一个实例存在，并提供返回实例对象的方法。在日常工作中，线程池、缓存、日志等对象通常被设计成单例模式，一方面减少了频繁创建销毁对象用以提升性能，另一方面避免了对共享资源的多重占用并简化了访问。

那么在高并发、多线程的环境下，是如何确保多个线程操作的是同一对象，也就是说保证对象的唯一性呢？这时就要用到单例模式，来确保实例化过程中，对象只被实例化了一次。本文将介绍一下单例模式的几种实现方式及性能分析。

## 1.饿汉模式

饿汉模式比较简单，在实例初始化的时候不管有没有用到，都会把实例先创建好，等待被调用。

```java
public class HungrySingleton {
    private static HungrySingleton instance=new HungrySingleton();
    private HungrySingleton(){}
    //返回实例对象
    public static HungrySingleton getInstance(){
        return instance;
    }
}
```

由于在加载的时候已经被实例化，只会创建一个实例，因此饿汉模式是线程安全的，能够充分保证单例。但是没有实现延迟加载，可能很长时间不被使用，影响程序性能。

## 2.懒汉模式

懒汉模式就是实例在被用到的时候才去创建，在使用的同时去检查有没有实例，如果有则返回，没有则新建。

```java
public class HoonSingleton {
    private static HoonSingleton instance = null;
    public HoonSingleton() {
    }
    public HoonSingleton getInstance() {
        if (instance == null) {
            instance = new HoonSingleton();
        }
        return instance;
    }
}
```

可以看出，在懒汉模式中，单例实例会被延迟加载，即只有在真正使用的时候才会实例化一个对象并交给自己的引用。由于使用了懒加载，因此在性能上要优于饿汉模式。

但是在多线程环境下，这种方法并不能够保证实例对象的唯一性，多线程时可能多个线程同时去实例化对象，因此不能保证线程的安全性。在此基础上进行改进，通过在`getInstance()`方法上加`synchronized`关键字，实现同步，可以实现线程安全。

```java
public synchronized static HoonSingleton getInstance() {
    if (instance == null) {
        instance = new HoonSingleton();
    }
    return instance;
}
```

通过使用`synchronized`保证了对临界资源的同步互斥访问，也就保证了单例同步方法，这一方式实现了线程安全，但是相应的该方法退化到了串行执行，并且同步方法的作用域比较大，锁的粒度太大，一定程度上降低了程序运行效率。

## 3.DCL模式

DCL模式又称为双检锁（`Double Check Locking`），也叫双重校验锁，综合了懒汉式和饿汉式两者的优点整合而成。

```java
public class DCL {
    private static DCL instance=null;
    private DCL(){
    }
    public static DCL getInstance(){
        if(null==instance)
            synchronized (DCL.class){
                if(null==instance)
                    instance=new DCL();
            }
        return instance;
    }
}
```

DCL中，在`synchronized`关键字内外都加了一层 if 条件判断，这样既保证了线程安全，又比直接上锁提高了执行效率，还节省了内存空间。因此，在实现了懒加载与保证线程安全性的同时，也保证了较好的性能。

尽管DCL看起来已经非常完善了，但是由于存在JVM指令重排序的存在（不清楚的可以查看上一篇文章），使得DCL仍然存在一些问题。

```java
 instance=new DCL();
```

尽管是很简单的一个语句，但是从执行上来看，这并不是一个原子操作。这一语句大概完成了三件事情：

- 给instance实例分配内存
- 使用instance的构造方法实例对象
- 将instance对象指向分配的内存空间，必须注意，到此为止instance返回就已经是非`null`的对象了

在此情况下，JVM为了优化指令提高程序运行效率，可能会将执行顺序中的第2、3步颠倒一下。以2个线程为例，可能出现以下情况：

1. 线程1，发现对象未实例化，准备开始执行构造方法实例对象；
2. 线程2调用instance实例，发现对象已经不为`null`，直接返回对象；
3. 对象构造方法未执行完毕，线程2调用instance中的一些对象返回空指针异常。

根据以上分析可知，解决这个问题可以通过加`volatile`关键字来确定指令执行顺序，避免指令重排序

```java
private volatile static DCL instance=null;
```

## 4.Holder模式

Holder模式也被称为静态内部类模式，在该模式下，可以通过使用内部静态类来以懒汉模式的思想来实现线程安全的对象单例。

```java
public class HolderDemo {
    private HolderDemo() {}
    private static class Holder {
        private static HolderDemo instance = new HolderDemo();
    }

    public static HolderDemo getInstance() {
        return Holder.instance;
    }
}
```

可以看出，在声明类的时候，它的成员中不包含需要声明的实例变量，而放到它的内部静态类中去创建实例。而静态的成员式内部类，该内部类的实例与外部类的实例没有绑定关系，只有被调用到时才会装载，这样一来也实现了懒加载。

## 5.枚举方式

枚举实现方式是在《Effective Java》一书中被提到的，具有功能完善使用简单，无偿地提供了序列化机制，在面对复杂的序列化或者反射攻击时仍然可以绝对防止多次实例化等优点。

```java
public class EnumSingletonDemo {
    private EnumSingletonDemo() {
    }

    private enum EnumHolder {
        INSTANCE;
        private EnumSingletonDemo instance;
        EnumHolder(){
            instance = new EnumSingletonDemo();
        }
    }

    public static EnumSingletonDemo getInstance() {
        return EnumHolder.INSTANCE.instance;
    }
}
```

由于Java中规定了每个枚举类型及其定义的枚举变量在JVM中都是唯一的，所以在加载的过程中只能被实例化一次，所以在其初始化的过程中是线程安全的。

在序列化方面，Java中枚举的序列化和反序列化都做了特殊的规定，这就可以避免反序列化过程中由于反射而导致的单例被破坏问题。使用枚举的方式，能够有效防止使用反射强行调用构造方法创建实例。

## 总结

本文介绍了单例模式的主要思想，并列举出了它的几种经典实现，并对几种实现的线程安全性与执行效率进行了分析。总的来说，可以按照以下规则进行实现方式的选择：

- 减少使用懒汉模式，线程安全或不安全模式下均有一定缺陷
- 如果设计序列化与反序列化时，可以选择枚举的方式
- 如果要实现懒加载，可以使用DCL及Holder模式
- 未声明需要懒加载，可以选择饿汉模式