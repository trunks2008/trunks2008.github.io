---
title: 面试官又整新活，居然问我for循环用i++和++i哪个效率高？
icon: page
order: 3
author: Hydra
date: 2021-11-24
tag:
  - JVM
star: true
---



<!-- more -->

前几天，一个小伙伴告诉我，他在面试的时候被面试官问了这么一个问题：

> 在for循环中，到底应该用 i++ 还是 ++i ？

听到这，我感觉这面试官确实有点不按套路出牌了，放着好好的八股文不问，净整些幺蛾子的东西。在临走的时候，小伙伴问面试官这道题的答案是什么，面试官没有明确告诉答案，只是说让从程序执行的效率角度自己思考一下。

好吧，既然这个问题被抛了出来，那我们就见招拆招，也给以后面试的小伙伴们排一下坑。

## 思路

前面提到，这个搞事情的面试官说要从**执行效率**的角度思考，那我们就抛开语义上的区别，从运行结果以外的效率来找找线索。回想一下，我们在以前介绍CAS的文章中提到过，后置自增`i++`和前置自增`++i`都不是原子操作，那么实际在执行过程中是什么样的呢？下面，我们从字节码指令的角度，从底层进行一波分析。

### i++ 执行过程

先写一段简单的代码，核心功能就只有赋值和自增操作：

```java
public static void main(String[] args) {
    int i=3;
    int j=i++;
    System.out.println(j);
}
```

下面用`javap`对字节码文件进行反编译，看一下实际执行的字节码指令：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/be5722cccab24ff89764e7f692148717~tplv-k3u1fbpfcp-zoom-1.image)

是不是有点难懂？没关系，接下来我们用图解的形式来直观地看看具体执行的过程，也帮大家解释一下晦涩的字节码指令是如何操作栈帧中的数据结构的，为了简洁起见，在图中只列出栈帧中比较重要的**操作数栈**和**局部变量表**。

上面的代码中除去打印语句，整体可以拆分成两步，我们先看第一步 `int i=3` 是如何执行的 。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0f5f6026142745869efb3bee105aaaa8~tplv-k3u1fbpfcp-zoom-1.image)

上面两条操作数栈和局部变量表相关的字节码指令还是比较容易理解的，下面再看一下第二步`int j=i++`的执行过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e64b9110c434f2ca9993d3d912ba591~tplv-k3u1fbpfcp-zoom-1.image)

在上图中需要注意的是，`iinc`能够直接更新局部变量表中的变量值，它不需要把数值压到操作数栈中就能够直接进行操作。在上面的过程中，抛去赋值等其他操作，`i++`实际执行的字节码指令是：

```java
2: iload_1
3: iinc    1, 1
```

如果把它翻译成我们能看懂的java代码，可以理解为：

```java
int temp=i;
i=i+1;
```

也就是说在这个过程中，除了必须的自增操作以外，又引入了一个新的局部变量，接下来我们再看看`++i`的执行过程。

### ++i 执行过程

我们对上面的代码做一点小小的改动，仅把`i++`换成`++i`，再来分析一下`++i`的执行过程是怎样的。

```java
public static void main(String[] args) {
    int i=3;
    int j=++i;
    System.out.println(j);
}
```

同样，用`javap`反编译字节码文件：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/22e635799eaa4a1dac1e9c2fbd5e08bf~tplv-k3u1fbpfcp-zoom-1.image)

`int i=3`对应前两行字节码指令，执行过程和前面`i++`例子中完全相同，可以忽略不计，重点还是通过图解的方式看一下`int j=++i`对应的字节码指令的执行过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b7a20dc616e9491e956d9ee17c22a644~tplv-k3u1fbpfcp-zoom-1.image)

抛去赋值操作，`++i`实际执行过程只有一行字节码指令：

```java
2: iinc    1, 1
```

转换成能理解的java代码的话，`++i`实际执行的就在局部变量中执行的：

```java
i=i+1;
```

这么看来，在使用`++i`时确实比`i++`少了一步操作，少引入了一个局部变量，如果在运算结果相同的场景下，使用`++i`的话的确效率会比`i++`高那么一点点。

那么回到开头的问题，两种自增方式应用在for循环中执行的时候，那种效率更高呢？刚才得出的结论仍然适用于for循环中吗，别急，让我们接着往下看。

### for循环中的自增

下面准备两段包含了for循环的代码，分别使用`i++`后置自增和`++i`前置自增：

```java
//i++ 后置自增
public class ForIpp {
    public static void main(String[] args) {
        for (int i = 0; i < 5; i++) {
            System.out.println(i);
        }
    }
}
//++i 前置自增
public class ForPpi {
    public static void main(String[] args) {
        for (int i = 0; i < 5; ++i) {
            System.out.println(i);
        }
    }
}
```

老规矩，还是直接反编译后的字节码文件，然后对比一下指令的执行过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2a7390ae600b4d93911d5390273cebfa~tplv-k3u1fbpfcp-zoom-1.image)

到这里，有趣的现象出现了，两段程序执行的字节码指令部分居然**一模一样**。先不考虑为什么会有这种现象，我们还是通过图解来看一下字节码指令的执行过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9a207e17f662488eafb23f503b0010d2~tplv-k3u1fbpfcp-zoom-1.image)

可以清晰的看到，在进行自增时，都是直接执行的`iinc`，在之前并没有执行`iload`的过程，也就是说，两段代码执行的都是`++i`。这一过程的验证其实还有更简单的方法，直接使用idea打开字节码文件，就可以看到最终for循环中使用的相同的**前置自增**方式。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e3193b56a8644859b1d3054593c42179~tplv-k3u1fbpfcp-zoom-1.image)

那么，为什么会出现这种现象呢？归根结底，还是java编译器对于代码的优化，在两种自增方式中，如果没有赋值操作，那么都会被优化成一种方式，就像下面的两个方法的代码：

```java
void ipp(){
    int i=3;
    i++;
}
void ppi(){
    int i=3;
    ++i;
}
```

最终执行时的字节码指令都是：

```java
0: iconst_3
1: istore_1
2: iinc    1, 1
5: return
```

可以看到，在上面的这种特定情况下，代码经过编译器的优化，保持了语义不变，并通过转换语法的形式提高了代码的运行效率。所以再回到我们开头的问题，就可以得出结论，在for循环中，通过jvm进行编译优化后，不论是`i++`还是`++i`，最终执行的方式都是`++i`，因此执行效率是相同的。

所以，以后再碰到这种半吊子的面试官，和你谈for循环中`i++`和`++i`的效率问题，自信点，直接把答案甩在他的脸上，**两种方式效率一样！**

>  本文代码基于Java 1.8.0_261-b12 版本测试