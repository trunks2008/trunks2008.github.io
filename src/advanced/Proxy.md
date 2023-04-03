---
title: 一文读懂Java中的代理模式
icon: page
order: 5
author: Hydra
date: 2020-04-02
tag:
  - 设计模式
  - 代理模式
star: true
---



<!-- more -->

代理（Proxy）模式是我们在工作中广泛使用的设计模式之一，提供了对目标对象额外的访问方式。通过代理对象来访问目标对象，可以对目标对象进行功能的增强，即扩展目标对象的功能。例如在Spring中，AOP就是使用动态代理来实现的。


举个栗子，当我们买不到演唱会门票时，只能通过找黄牛替我们买票，将买票这一过程交给他们去代办。在这一环节中，我们不接触到真正的购票公司，黄牛就相当于是代理。目标对象购票公司提供一个代理对象黄牛，通过黄牛可以调用购票公司的部分功能（买票），并添加一些额外的业务功能（交额外的手续费）。

JAVA中实现代理的存在两种方式，下面分别对其进行介绍。

### 一、静态代理

从创建时期来看，静态代理是由程序员创建或特定工具自动生成源代码再对其编译。在程序运行前代理类的class文件就已经存在了。
从实现方式来看，又可分为继承和聚合两种方式。通过代理类的对象调用重写的方法时，实际上执行的是被代理类同样的方法的调用。

#### 1、继承方式

代理类继承目标类，重写目标类中需要增强的方法：

```java
//售票公司
public class TicketCompany {
    public void sellTicket(){
        System.out.println("售票");
    }
}

//黄牛
public class TicketScalper extends TicketCompany{
    @Override
    public void sellTicket() {
        super.sellTicket();
        System.out.println("收手续费");
    }
}
```

#### 2、聚合方式

代理类和目标类实现同一个接口，代理对象当中要包含目标对象。代理类中通过注入目标类的对象，然后重写方法进行功能增强。

```java
public interface Company {
    public void sellTicket();
}

//售票公司
public class TicketCompany implements Company{
    @Override
    public void sellTicket(){
        System.out.println("售票");
    }
}

//黄牛
public class TicketScalper implements Company{
    TicketCompany ticketCompany;
    public TicketScalper( TicketCompany ticketCompany){
        this.ticketCompany=ticketCompany;
    }
    @Override
    public void sellTicket() {
        ticketCompany.sellTicket();
        System.out.println("收手续费");
    }
}
```

通过以上两种静态代理方式，可以做到在不修改目标对象的功能前提下，对目标功能进行扩展。但是也存在一些缺点，每当我们需要扩展目标类的功能时，就需要重写一个代理类，容易造成代理类过多，项目结构复杂。此外，一旦接口增加方法，目标对象与代理对象都要维护。


总结：如果在不确定的情况下，尽量不要去使用静态代理。因为一旦写代码，就会产生类，容易造成文件规模的大量增长。那么如何解决这些缺陷呢？我们使用动态代理。

### 二、动态代理

在静态代理中，一个代理对象只能代理一个目标对象，并且在编译时就已经确定代理逻辑。而动态代理是在运行时，通过反射机制动态创建而成，并且能够代理各种类型的对象。而动态代理也存在两种方式，JDK动态代理与CGLIB代理。

#### 1、JDK动态代理

Java中的`Proxy`类，提供了`newInstance`静态方法可以动态生成代理对象。

先看看代码实现：

```java
public class TicketScalperJdkProxy {
    public static void main(String[] args) {
        TicketCompany ticketCompany = new TicketCompany();
        Company company =(Company) Proxy.newProxyInstance(ticketCompany.getClass().getClassLoader(),
                ticketCompany.getClass().getInterfaces(),
                new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                        if(method.getName().equals("sellTicket")){
                            System.out.println("黄牛收取手续费");
                        }
                        return method.invoke(ticketCompany, args);
                    }
                });
        company.sellTicket();
    }
}
```

`newProxyInstance`方法中传入的三个参数，依次为：

- `ClassLoader loader`：指定当前目标对象使用类加载器，一般使用目标对象的类加载器
- `Class<?>[] interfaces`：目标对象实现的接口的类型，使用泛型方式确认类型
- `InvocationHandler h`：事件处理，执行目标对象的方法时，会触发事件处理器的方法,会把当前执行目标对象的方法作为参数传入，通过其中的`invoke`方法进行功能的增强

从传入的第二个参数中，可以发现，要实现JDK动态代理，目标对象必须实现一个接口，才能对接口中的方法进行代理。那么如果没有实现接口呢？CGLIB为我们提供了另一种方式。

#### 2、CGLIB代理

JDK动态代理虽然简单易用，但是只能对接口进行代理。如果被代理的类是一个普通类没有接口，那么JDK动态代理就没法使用了，这时就可以使用CGLIB基于继承来实现代理。

CGLIB（`Code Generator Library`）是一个强大的、高性能的代码生成库。底层使用了ASM（一个短小精悍的字节码操作框架）来操作字节码生成新的类。

使用CGLIB来实现功能增强：

```java
public class CglibTest {
    public static void main(String[] args) {
        Enhancer enhancer=new Enhancer();
        enhancer.setSuperclass(TicketCompany.class);
        enhancer.setCallback(new MethodInterceptor() {
            @Override
            public Object intercept(Object o, Method method, Object[] objects, MethodProxy methodProxy) throws Throwable {
                System.out.println("收手续费");
                Object result = methodProxy.invokeSuper(o, args);
                System.out.println("完成交易");
                return result;
            }
        });
        TicketCompany sampleClass=(TicketCompany) enhancer.create();
        sampleClass.sellTicket();
    }
}
```

需要注意的是，目标类不能为final，目标对象的方法如果为final / static，那么就不会被拦截，即不会执行目标对象额外的业务方法。

最后顺带看一下Spring AOP中使用的代理。在Spring中，通过注解来开启AOP时，默认使用的代理方式为JDK动态代理

```java
@Configuration
@EnableAspectJAutoProxy()
public class AppConfig {
}
```

使用debug看一下获取的代理对象：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fccf1c6f45e641b687b5e1d80edf13c0~tplv-k3u1fbpfcp-zoom-1.image)

修改`@EnableAspectJAutoProxy`注解中`proxyTargetClass`的属性，可以将其替换为CGLIB代理方式

```java
@Configuration
@EnableAspectJAutoProxy(proxyTargetClass=true)
public class AppConfig {
}
```

再看一下代理对象，已经变为使用CGLIB代理方式：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85cf942ab3ff40e4bad7fcab099dc767~tplv-k3u1fbpfcp-zoom-1.image)

总的来说，JDK动态代理使用Java原生的反射API来进行操作，在生成类上比较高效；CGLIB使用ASM框架直接对字节码进行操作，在类的执行过程中比较高效。至于具体的使用，更多还要取舍于我们的应用环境，还是那句话，没有最好的技术，只有更适用的业务场景。