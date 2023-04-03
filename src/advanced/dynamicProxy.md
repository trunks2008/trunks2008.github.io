---
title: JDK动态代理为什么必须要基于接口？
icon: page
order: 6
author: Hydra
date: 2022-02-22
tag:
  - JDK
  - 动态代理
star: true
---



<!-- more -->

前几天的时候，交流群里的小伙伴抛出了一个问题，**为什么JDK的动态代理一定要基于接口实现呢？**

好的安排，其实要想弄懂这个问题还是需要一些关于代理和反射的底层知识的，我们今天就盘一盘这个问题，走你~

## 一个简单的例子

在分析原因之前，我们先完整的看一下实现jdk动态代理需要几个步骤，首先需要定义一个接口：

```java
public interface Worker {
    void work();
}
```

再写一个基于这个接口的实现类：

```java
public class Programmer implements Worker {
    @Override
    public void work() {
        System.out.println("coding...");
    }
}
```

自定义一个`Handler`，实现`InvocationHandler`接口，通过重写内部的`invoke`方法实现逻辑增强。其实这个`InvocationHandler`可以使用匿名内部类的形式定义，这里为了结构清晰拿出来单独声明。

```java
public class WorkHandler implements InvocationHandler {
    private Object target;
    WorkHandler(Object target){
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (method.getName().equals("work")) {
            System.out.println("before work...");
            Object result = method.invoke(target, args);
            System.out.println("after work...");
            return result;
        }
        return method.invoke(target, args);
    }
}
```

在`main`方法中进行测试，使用`Proxy`类的静态方法`newProxyInstance`生成一个代理对象并调用方法：

```java
public static void main(String[] args) {
    Programmer programmer = new Programmer();
    Worker worker = (Worker) Proxy.newProxyInstance(
            programmer.getClass().getClassLoader(),
            programmer.getClass().getInterfaces(),
            new WorkHandler(programmer));
    worker.work();
}
```

执行上面的代码，输出：

```shell
before work...
coding...
after work...
```

可以看到，执行了方法逻辑的增强，到这，一个简单的动态代理过程就实现了，下面我们分析一下源码。

## Proxy源码解析

既然是一个代理的过程，那么肯定存在**原生对象**和**代理对象**之分，下面我们查看源码中是如何动态的创建代理对象的过程。上面例子中，创建代理对象调用的是`Proxy`类的静态方法`newProxyInstance`，查看一下源码：

```java
@CallerSensitive
public static Object newProxyInstance(ClassLoader loader,Class<?>[] interfaces,InvocationHandler h) throws IllegalArgumentException{
    Objects.requireNonNull(h);

    final Class<?>[] intfs = interfaces.clone();
    final SecurityManager sm = System.getSecurityManager();
    if (sm != null) {
        checkProxyAccess(Reflection.getCallerClass(), loader, intfs);
    }

    /*
     * Look up or generate the designated proxy class.
     */
    Class<?> cl = getProxyClass0(loader, intfs);

    /*
     * Invoke its constructor with the designated invocation handler.
     */
    try {
        if (sm != null) {
            checkNewProxyPermission(Reflection.getCallerClass(), cl);
        }

        final Constructor<?> cons = cl.getConstructor(constructorParams);
        final InvocationHandler ih = h;
        if (!Modifier.isPublic(cl.getModifiers())) {
            AccessController.doPrivileged(new PrivilegedAction<Void>() {
                public Void run() {
                    cons.setAccessible(true);
                    return null;
                }
            });
        }
        return cons.newInstance(new Object[]{h});
    }//省略catch
}
```

概括一下上面代码中重点部分：

- 在`checkProxyAccess`方法中，进行参数验证
- 在`getProxyClass0`方法中，生成一个代理类`Class`或者寻找已生成过的代理类的缓存
- 通过`getConstructor`方法，获取生成的代理类的构造方法
- 通过`newInstance`方法，生成实例对象，也就是最终的代理对象

上面这个过程中，获取构造方法和生成对象都是直接利用的反射，而需要重点看看的是生成代理类的方法`getProxyClass0`。

```java
private static Class<?> getProxyClass0(ClassLoader loader,
                                       Class<?>... interfaces) {
    if (interfaces.length > 65535) {
        throw new IllegalArgumentException("interface limit exceeded");
    }

    // If the proxy class defined by the given loader implementing
    // the given interfaces exists, this will simply return the cached copy;
    // otherwise, it will create the proxy class via the ProxyClassFactory
    return proxyClassCache.get(loader, interfaces);
}
```

注释写的非常清晰，如果缓存中已经存在了就直接从缓存中取，这里的`proxyClassCache`是一个`WeakCache`类型，如果缓存中目标`classLoader`和接口数组对应的类已经存在，那么返回缓存的副本。如果没有就使用`ProxyClassFactory`去生成Class对象。中间的调用流程可以省略，最终实际调用了`ProxyClassFactory`的`apply`方法生成Class。在`apply`方法中，主要做了下面3件事。

- 首先，根据规则生成文件名：

```java
if (proxyPkg == null) {
    // if no non-public proxy interfaces, use com.sun.proxy package
    proxyPkg = ReflectUtil.PROXY_PACKAGE + ".";
}
/*
 * Choose a name for the proxy class to generate.
 */
long num = nextUniqueNumber.getAndIncrement();
String proxyName = proxyPkg + proxyClassNamePrefix + num;
```

如果接口被定义为`public`公有，那么默认会使用`com.sun.proxy`作为包名，类名是`$Proxy`加上一个自增的整数值，初始时是0，因此生成的文件名是`$Proxy0`。

如果是非公有接口，那么会使用和被代理类一样的包名，可以写一个`private`接口的例子进行一下测试。

```java
package com.hydra.test.face;
public class InnerTest {
    private interface InnerInterface {
        void run();
    }

    class InnerClazz implements InnerInterface {
        @Override
        public void run() {
            System.out.println("go");
        }
    }
}
```

这时生成的代理类的包名为`com.hydra.test.face`，与被代理类相同：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5017e373299f4c0fa81b1e1ae107e533~tplv-k3u1fbpfcp-zoom-1.image)

- 然后，利用`ProxyGenerator.generateProxyClass`方法生成代理的字节码数组：

```java
byte[] proxyClassFile = ProxyGenerator.generateProxyClass(
      proxyName, interfaces, accessFlags);
```

在`generateProxyClass`方法中，有一个重要的参数会发挥作用：

```java
private static final boolean saveGeneratedFiles = (Boolean)AccessController.doPrivileged(new GetBooleanAction("sun.misc.ProxyGenerator.saveGeneratedFiles"));
```

如果这个属性被配置为`true`，那么会把字节码存储到硬盘上的class文件中，否则不会保存临时的字节码文件。

- 最后，调用本地方法`defineClass0`生成Class对象：

```java
return defineClass0(loader, proxyName,
      proxyClassFile, 0, proxyClassFile.length);
```

返回代理类的Class后的流程我们在前面就已经介绍过了，先获得构造方法，再使用构造方法反射的方式创建代理对象。

## 神秘的代理对象

创建代理对象流程的源码分析完了，我们可以先通过debug来看看上面生成的这个代理对象究竟是个什么：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6c0df998ed7a400da0b4b3d3d31eddca~tplv-k3u1fbpfcp-zoom-1.image)

和源码中看到的规则一样，是一个Class为`$Proxy0`的神秘对象，再看一下代理对象的Class的详细信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c4a041c8e20c4fab8ac1c2778dd182c2~tplv-k3u1fbpfcp-zoom-1.image)

类的全限定名是`com.sun.proxy.$Proxy0`，在上面我们提到过，这个类是在运行过程中动态生成的，并且程序执行完成后，会自动删除掉class文件。如果想要保留这个临时文件不被删除，就要修改我们上面提到的参数，具体操作起来有两种方式，第一种是在启动`VM`参数中加入：

```shell
-Dsun.misc.ProxyGenerator.saveGeneratedFiles=true
```

第二种是在代码中加入下面这一句，注意要加在生成动态代理对象之前：

```java
System.getProperties().put("sun.misc.ProxyGenerator.saveGeneratedFiles", "true");
```

使用了上面两种方式中的任意一种后，就可以保存下来临时的字节码文件了，需要注意这个文件生成的位置，并不是在`target`目录下，而是生成在项目目录下的`com\sun\proxy`中，正好和默认生成的包名对应。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1c4392dcb874b88adb82bbcf2e066d8~tplv-k3u1fbpfcp-zoom-1.image)

拿到字节码文件后，就可以使用反编译工具来反编译它了，这里使用`jad`在cmd下一条命令直接搞定：

```shell
jad -s java $Proxy0.class
```

看一下反编译后`$Proxy0.java`文件的内容，下面的代码中，我只保留了核心部分，省略了无关紧要的`equals`、`toString`、`hashCode`方法的定义。

```java
public final class $Proxy0 extends Proxy implements Worker{
    public $Proxy0(InvocationHandler invocationhandler){
        super(invocationhandler);
    }

    public final void work(){
        try{
            super.h.invoke(this, m3, null);
            return;
        }catch(Error _ex) { }
        catch(Throwable throwable){
            throw new UndeclaredThrowableException(throwable);
        }
    }

    private static Method m3;
    static {
        try{           
            m3 = Class.forName("com.hydra.test.Worker").getMethod("work", new Class[0]);   
            //省略其他Method
        }//省略catch
    }
}
```

这个临时生成的代理类`$Proxy0`中主要做了下面的几件事：

- 在这个类的静态代码块中，通过反射初始化了多个静态方法`Method`变量，除了接口中的方法还有`equals`、`toString`、`hashCode`这三个方法
- 继承父类`Proxy`，实例化的过程中会调用父类的构造方法，构造方法中传入的`invocationHandler`对象实际上就是我们自定义的`WorkHandler`的实例
- 实现了自定义的接口`Worker`，并重写了`work`方法，方法内调用了`InvocationHandler`的`invoke`方法，也就是实际上调用了`WorkHandler`的`invoke`方法
- 省略的`equals`、`toString`、`hashCode`方法实现也一样，都是调用`super.h.invoke()`方法

到这里，整体的流程就分析完了，我们可以用一张图来简要总结上面的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/07352f979ffd4ba28ebbcaaed6a6f331~tplv-k3u1fbpfcp-zoom-1.image)

## 为什么要有接口？

通过上面的分析，我们已经知道了代理对象是如何生成的了，那么回到开头的问题，为什么jdk的动态代理一定要基于接口呢？

其实如果不看上面的分析，我们也应该知道，要扩展一个类有常见的两种方式，继承父类或实现接口。这两种方式都允许我们对方法的逻辑进行增强，但现在不是由我们自己来重写方法，而是要想办法让jvm去调用`InvocationHandler`中的`invoke`方法，也就是说代理类需要和两个东西关联在一起：

- 被代理类
- InvocationHandler

而jdk处理这个问题的方式是选择继承父类`Proxy`，并把`InvocationHandler`存在父类的对象中：

```java
public class Proxy implements java.io.Serializable {
    protected InvocationHandler h;
    protected Proxy(InvocationHandler h) {
        Objects.requireNonNull(h);
        this.h = h;
    }
    //...
}
```

通过父类`Proxy`的构造方法，保存了创建代理对象过程中传进来的`InvocationHandler`的实例，使用`protected`修饰保证了它可以在子类中被访问和使用。但是同时，因为java是单继承的，因此在继承了`Proxy`后，只能通过实现目标接口的方式来实现方法的扩展，达到我们增强目标方法逻辑的目的。

## 扯点别的

其实看完源码、弄明白代理对象生成的流程后，我们还可以用另一种方法实现动态代理：

```java
public static void main(String[] args) throws Exception {
    Class<?> proxyClass = Proxy.getProxyClass(Test3.class.getClassLoader(), Worker.class);
    Constructor<?> constructor = proxyClass.getConstructor(InvocationHandler.class);
    InvocationHandler workHandler = new WorkHandler(new Programmer());
    Worker worker = (Worker) constructor.newInstance(workHandler);
    worker.work();
}
```

运行结果与之前相同，这种写法其实就是抽出了我们前面介绍的几个核心方法，中间省略了一些参数的校验过程，这种方式可以帮助大家熟悉jdk动态代理原理，但是在使用过程中还是建议大家使用标准方式，相对更加安全规范。

## 总结

本文从源码以及实验的角度，分析了jdk动态代理生成代理对象的流程，通过代理类的实现原理分析了为什么jdk动态代理一定要基于接口实现。总的来说，jdk动态代理的应用还是非常广泛的，例如在Spring、Mybatis以及Feign等很多框架中动态代理都被大量的使用，可以说学好jdk动态代理，对于我们阅读这些框架的底层源码还是很有帮助的。