---
title: Spring循环依赖源码解析
icon: page
order: 3
author: Hydra
date: 2020-06-23
tag:
  - Spring
star: true
---



<!-- more -->

上篇文章中我们分析完了Spring中Bean的实例化过程，但是没有对循环依赖的问题进行分析，这篇文章中我们来看一下spring是如何解决循环依赖的实现。

之前在讲spring的过程中，我们提到了一个spring的单例池`singletonObjects`，用于存放创建好的bean，也提到过这个Map也可以说是狭义上的spring容器。

```java
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<String, Object>(256);
```

其实spring在缓存bean的过程中并不是只有这一个Map，我们看一下`DefaultSingletonBeanRegistry`这个类，在其中其实存在3个Map，这也就是经常提到的spring三级缓存。

```java
/** Cache of singleton objects: bean name --> bean instance */
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<String, Object>(256);
/** Cache of early singleton objects: bean name --> bean instance */
private final Map<String, Object> earlySingletonObjects = new HashMap<String, Object>(16);
/** Cache of singleton factories: bean name --> ObjectFactory */
private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<String, ObjectFactory<?>>(16);
```

从上到下分别为一到三级缓存，这里先对三级缓存有一个初步的认识，后面使用到的时候我们再详细分析。

## 循环依赖实现流程

下面开始分析spring循环依赖的注入实现过程。先写两个bean，在它们中分别注入了对方：

```java
@Component
public class ServiceA {
  @Autowired
  ServiceB serviceB;  
  
  public ServiceB getServiceB() {
    System.out.println("get ServiceB");
    return serviceB;
  }
}
```

```java
@Component
public class ServiceB {
  @Autowired
  ServiceA serviceA;  
  
  public ServiceA getServiceA() {
    return serviceA;
  }
}
```

进行测试，分别调用它们的get方法，能够正常获得bean，说明循环依赖是可以实现的：

```properties
com.hydra.service.ServiceB@58fdd99
com.hydra.service.ServiceA@6b1274d2
```

首先，回顾一下上篇文章中讲过的bean实例化的流程。下面的内容较多依赖于spring的bean实例化源码，如果不熟悉建议花点时间阅读一下上篇文章。

在`AbstractAutowireCapableBeanFactory`的`doCreateBean`方法中，调用`createBeanInstance`方法创建一个原生对象，之后调用`populateBean`方法执行属性的填充，最后调用各种回调方法和后置处理器。

但是在执行`populateBean`方法前，上篇文章中省略了一些涉及到循环依赖的内容，看一下下面这段代码：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d19b12ba0d514dcc871f90d8889dc450~tplv-k3u1fbpfcp-zoom-1.image)

上面的代码先进行判断：如果当前创建的是单例bean，并且允许循环依赖，并且处于创建过程中，那么执行下面的`addSingletonFactory`方法。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bce1a1ac65ee4210a25d8ec98a7b46c2~tplv-k3u1fbpfcp-zoom-1.image)

主要工作为将lambda表达式代表的`ObjectFactory`，放入三级缓存的Map中。注意这里只是一个存放的操作，并没有实际执行lambda表达式中的内容，具体调用过程是在后面调用ObjectFactory的getObject方法时调用。这个方法执行完成后，三级缓存中存放了一条`serviceA`的数据，二级缓存仍然为空。

回到正常调用流程，生成原生对象后，调用`populateBean`方法进行属性的赋值也就是依赖注入，具体是通过执行`AutowiredAnnotationBeanPostProcessor`这一后置处理器的`postProcessPropertyValues`方法。

在这一过程中，`serviceA`会找到它依赖的`serviceB`这一属性，当发现依赖后，会调用`DefaultListableBeanFactory`的`doResolveDependency`方法，之后执行`resolveCandidate`方法，在该方法中，尝试使用`beanFactory`获取到`serviceB`的bean实例。

```java
public Object resolveCandidate(String beanName, Class<?> requiredType, BeanFactory beanFactory)
      throws BeansException {
    return beanFactory.getBean(beanName);
  }
```

这时和之前没有循环依赖时的情况就会有些不一样了，因为现在`serviceB`还没有被创建出来，所以通过`beanFactory`是无法直接获取的。因此当在`doGetBean`方法中调用`getSingleton`方法会返回一个null值：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6cecf7e61f5e451493bc095e7f2d2206~tplv-k3u1fbpfcp-zoom-1.image)

因此，继续使用与之前相同的创建bean的流程，实例化`serviceB`的bean对象。当`serviceB`的原生对象被实例化完成后，同样可以看到它依赖的`serviceA`还没有被赋值：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c165b8642b5f4e2597dc8f37e43a464e~tplv-k3u1fbpfcp-zoom-1.image)

创建完`serviceB`的原生对象后，同样执行`addSingletonFactory`方法，将`serviceB`放入三级缓存中，执行完成后，三级缓存中就已经存在了两个bean的缓存：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/65003f1fc9ee46bab0a295ccb570121d~tplv-k3u1fbpfcp-zoom-1.image)

向下执行，`serviceB`会调用`populateBean`方法进行属性填充。和之前`serviceA`依赖`serviceB`相同的调用链，执行到`resolveCandidate`方法，尝试使用`beanFactory`的`getBean`去获取`serviceA`。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5b350ebb21fc471b8777106c26424d6c~tplv-k3u1fbpfcp-zoom-1.image)

向下执行，调用`getSingleton`方法尝试直接获取`serviceA`，此时三级缓存`singletonFactories`中我们之前已经存进去了一个key为`serviceA`的`beanName`，value为lambda表达式，这时可以直接获取到。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/db09067428544e54b3f08dfccba40def~tplv-k3u1fbpfcp-zoom-1.image)

在执行`singletonFactory`的`getObject`方法时才去真正执行lambda表达式中的方法，实际执行的是`getEarlyBeanReference`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3921a6b9be504f3a9aacf0e4a8dc7f78~tplv-k3u1fbpfcp-zoom-1.image)

在遍历后置处理器后，获取到`serviceA`的执行过后置处理器后的对象，执行：

```java
this.earlySingletonObjects.put(beanName, singletonObject);
this.singletonFactories.remove(beanName);
```

这里将`serviceA`放入二级缓存`earlySingletonObjects`，并从三级缓存`singletonFactories`中移除。在这一步执行完后，三级缓存中的`serviceA`就没有了。

当我们从缓存中获取了`serviceA`的bean后，就不会再调用`createBean`去重复创建新的bean了。之后，顺调用链返回`serviceB`调用的`doResolveDependency`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9abbe1bfb8a2437a8d49c68759aaa899~tplv-k3u1fbpfcp-zoom-1.image)

`serviceB`就成功获取到了它的依赖的`serviceA`属性的bean对象，回到`inject`方法，使用反射给`serviceA`赋值成功。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/62acc55e58704432803c760d849eee18~tplv-k3u1fbpfcp-zoom-1.image)

回到`doCreateBean`的方法，可以看到`serviceB`的`serviceA`属性已经被注入了，但是`serviceA`中的`serviceB`属性还是`null`。说明`serviceB`的依赖注入已经完成，而`serviceA`的依赖注入还没做完。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/89fe9597a8864e649b50edda6f9da15a~tplv-k3u1fbpfcp-zoom-1.image)

现在我们梳理一下运行到这里的流程：

1、在`serviceA`填充属性过程中发现依赖了`serviceB`，通过`beanFactory`的`getBean`方法，尝试获取`serviceB`

2、`serviceB`不存在，执行了一遍`serviceB`的创建流程，填充属性时发现`serviceA`已经存在于三级缓存，直接注入给`serviceB`

可以看到，在创建`serviceA`的过程中发现依赖的`serviceB`不存在，转而去创建了`serviceB`，而创建`serviceA`的流程并没有执行完，因此在创建完`serviceB`后再顺调用链返回，直到`doResolveDependency`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ecefe77ebe114e71948a9db531cc1c9d~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，需要依赖的`serviceB`已经被创建并返回成功，返回到`inject`方法，同样通过反射给`serviceB`赋值：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/197c39314ade4da9858b4f5f8fc60bad~tplv-k3u1fbpfcp-zoom-1.image)

返回`doCreateBean`方法，可以看到`serviceA`和`serviceB`之间的循环依赖已经完成了：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/55f790a26f7c4b3abba86403e80fed7a~tplv-k3u1fbpfcp-zoom-1.image)

这样，一个最简单的循环依赖流程就结束了。有的小伙伴可能会提出疑问，这样的话，我只需要添加一个缓存存放原生对象就够了啊，为什么还需要二级缓存和三级缓存两层结构呢？

## AOP下循环依赖具体实现

我们看看下面的例子，前面的两个serviceA和serviceB不变，我们添加一个`BeanPostProcessor`：

 ```java
@Component
public class MyPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (beanName.equals("serviceA")){
            System.out.println("create new ServiceA");
            return new ServiceA();
        }
        return bean;
    }
}
 ```

运行一下，结果报错了：

 ```java
Exception in thread "main" org.springframework.beans.factory.BeanCurrentlyInCreationException: 
Error creating bean with name 'serviceA': Bean with name 'serviceA' 
has been injected into other beans [serviceB] in its raw version as 
part of a circular reference, but has eventually been wrapped. This 
means that said other beans do not use the final version of the bean.
 This is often the result of over-eager type matching - consider 
 using 'getBeanNamesOfType' with the 'allowEagerInit' flag turned 
 off, for example.
 ```

在分析错误之前，我们再梳理一下正常循环依赖的过程：

1、初始化原生对象serviceA，放入三级缓存

2、serviceA填充属性，发现依赖serviceB，创建依赖对象

3、创建serviceB，填充属性发现依赖serviceA，从三级缓存中找到填充

4、执行serviceB的后置处理器和回调方法，放入单例池

5、执行serviceA的后置处理器和回调方法，放入单例池

再回头看上面的错误，大意为在循环依赖中我们给serviceB注入了serviceA，但是注入之后我们又在后置处理器中对serviceA进行了包装，因此导致了serviceB中注入的和最后生成的serviceA不一致。

但是熟悉aop的同学应该知道，aop的底层也是利用后置处理器实现的啊，那么为什么aop就可以正常执行呢？我们添加一个切面横切serviceA的`getServiceB`方法：

```java
@Component
@Aspect
public class MyAspect {
    @Around("execution(* com.hydra.service.ServiceA.getServiceB())")
    public void invoke(ProceedingJoinPoint pjp){
        try{
            System.out.println("execute aop around method");
            pjp.proceed();
        }catch (Throwable e){
            e.printStackTrace();
        }
    }
}
```

先不看运行结果，代码可以正常执行不出现异常，那么aop是怎么实现的呢？

前面的流程和不使用aop相同，我们运行到serviceB需要注入serviceA的地方，调用`getSingleton`方法从三级缓存中获取serviceA存储的`singletonFactory`，调用`getEarlyBeanReference`方法。在该方法中遍历执行`SmartInstantiationAwareBeanPostProcessor`后置处理器的`getEarlyBeanReference`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9693e989be004180a9230cadfff63fe2~tplv-k3u1fbpfcp-zoom-1.image)

看一下都有哪些类实现了这个方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8388998fc9e9493ebed512f6a4f590e8~tplv-k3u1fbpfcp-zoom-1.image)

在spring中，就是这个`AbstractAutoProxyCreator`负责实现了aop，进入`getEarlyBeanReference`方法：

```java
public Object getEarlyBeanReference(Object bean, String beanName) throws BeansException {
    //beanName
    Object cacheKey = getCacheKey(bean.getClass(), beanName);
    this.earlyProxyReferences.put(cacheKey, bean); 
    //产生代理对象
    return wrapIfNecessary(bean, beanName, cacheKey); 
}
```

`earlyProxyReferences` 是一个Map，用于缓存bean的原始对象，也就是执行aop之前的bean，非常重要，在后面还会用到这个Map：

```java
Map<Object, Object> earlyProxyReferences = new ConcurrentHashMap<>(16);
```

记住下面这个`wrapIfNecessary`方法，它才是真正负责生成代理对象的方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a5655636517049529d50124e0ad33f64~tplv-k3u1fbpfcp-zoom-1.image)

上面首先解析并拿到所有的切面，调用`createProxy`方法创建代理对象并返回。然后回到`getSingleton`方法中，将serviceA加入二级缓存，并从三级缓存中移除掉。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cc1248918d6343fe8630f7d0c8d3e864~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，二级缓存中的serviceA已经是被cglib代理过的代理对象了，当然这时的serviceA还是没有属性值填充的。

那么这里又会有一个问题，我们之前讲过，在填充完属性后，会调用后置处理器中的方法，而这些方法都是基于原始对象的，而不是代理对象。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f94d256d5b094a91adb1005c24571f94~tplv-k3u1fbpfcp-zoom-1.image)

在前一篇文章中我们也讲过，在`initializeBean`方法中会执行后置处理器，并且正常情况下aop也是在这里完成的。那么我们就要面临一个问题，如果避免重复执行aop的过程。在`initializeBean`方法中：

```java
if (mbd == null || !mbd.isSynthetic()) {
  wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
}
```

调用`applyBeanPostProcessorsAfterInitialization`，执行所有后置处理器的`after`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cd513ce0c88496fb1136d6e549d1ff8~tplv-k3u1fbpfcp-zoom-1.image)

执行`AbstractAutoProxyCreator`的`postProcessAfterInitialization`方法：

```java
public Object postProcessAfterInitialization(@Nullable Object bean, String beanName) throws BeansException {
  if (bean != null) {
    Object cacheKey = getCacheKey(bean.getClass(), beanName);
    if (this.earlyProxyReferences.remove(cacheKey) != bean) {
      return wrapIfNecessary(bean, beanName, cacheKey);
    }
  }
  return bean;
}
```

`earlyProxyReferences` 我们之前说过非常重要，它缓存了进行aop之前的原始对象，并且这里参数传入的Object也是原始对象。因此在这里执行`remove`操作的判断语句返回`false`，不会执行if中的语句，不会再执行一遍aop的过程。

回过头来再梳理一下，因为之前进行过循环依赖，所以提前执行了`AbstractAutoProxyCreator`的`getEarlyBeanReference`方法，执行了aop的过程，在`earlyProxyReferences`中缓存了原生对象。因此在循环依赖的情况下，等式成立，直接返回。而在没有循环依赖的普通情况下，`earlyProxyReferences`执行`remove`返回为`null`，等式不成立，正常执行aop流程。

需要注意的是，这个方法中最终返回的还是原始对象，而不是aop后的代理对象。执行到这一步，我们先看一下嵌套的状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7f52f549a6ec4841b303194c0df92844~tplv-k3u1fbpfcp-zoom-1.image)

对外暴露的serviceA是原始对象，依赖的serviceB已经被注入了。而serviceB中依赖的serviceA是代理对象，并且这个代理对象依赖的serviceB还没有被注入。

向下执行：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2a875d7de1664848850eb17a1f419edc~tplv-k3u1fbpfcp-zoom-1.image)

再次通过`getSingleton`获取serviceA：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/25fe47873b5b4b73802a3654867f6a35~tplv-k3u1fbpfcp-zoom-1.image)

这次我们通过二级缓存就可以拿到之前经过aop的代理对象，因此不用找三级缓存直接返回这个代理对象，并最终把这个代理对象添加到一级缓存单例池中。

到这，我们对三级缓存的作用做一个总结：

1、`singletonObjects`：单例池，缓存了经过完整生命周期的bean

2、`earlySingletonObjects`：缓存了提前曝光的原始对象，注意这里存的还不是bean，这里存的对象经过了aop的代理，但是没有执行属性的填充以及后置处理器方法的执行

3、`singletonFactories`：缓存的是`ObjectFactory`，主要用来去生成原始对象进行了aop之后得到的代理对象。在每个bean的生成过程中，都会提前在这里缓存一个工厂。如果没有出现循环依赖依赖这个bean，那么这个工厂不会起到作用，按照正常生命周期执行，执行完后直接把本bean放入一级缓存中。如果出现了循环依赖依赖了这个bean，没有aop的情况下直接返回原始对象，有aop的情况下返回代理对象。

全部创建流程结束，看一下结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6254e95574d14bb5995ede3ef49d53aa~tplv-k3u1fbpfcp-zoom-1.image)

我们发现，在生成的serviceA的`cglib`代理对象中，serviceB属性值并没有被填充，只有serviceB中serviceA的属性填充成功了。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3d3870a2e2fa4367a4c1bf830d87034c~tplv-k3u1fbpfcp-zoom-1.image)

可以看到如果使用cglib，在代理对象的`target`中会包裹一个原始对象，而原始对象的属性是被填充过的。

那么，如果不使用cglib代理，而使用jdk动态代理呢？我们对之前的代码进行一下改造，添加两个接口：

```java
public interface IServiceA {
    public IServiceB getServiceB();
}
public interface IServiceB {
    public IServiceA getServiceA();
}
```

改造两个Service类：

```java
@Component
public class ServiceA implements IServiceA{
    @Autowired
    private IServiceB serviceB;

    public IServiceB getServiceB() {
        System.out.println("get ServiceB");
        return this.serviceB;
    }
}
@Component
public class ServiceB implements IServiceB{
    @Autowired
    private IServiceA serviceA;

    public IServiceA getServiceA() {
        System.out.println("get ServiceA");
        return serviceA;
    }
}
```

执行结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c007a9bbdad143d793bec388fe5578a9~tplv-k3u1fbpfcp-zoom-1.image)

看一下serviceA的详细信息：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bdf3cd2e172644a2bfc401a2ac3a3fe2~tplv-k3u1fbpfcp-zoom-1.image)

同样也是在`target`中包裹了原生对象，并在原生对象中注入了serviceB的实例。

综上两种方法，可以看出在我们执行serviceA的getServiceB方法时，都无法正常获取到其bean对象，都会返回一个`null`值。那么如果非要直接获得这个serviceB应该怎么办呢？

我们可以通过反射的方式，先看cglib代理情况下：

```java
ServiceA serviceA= (ServiceA) context.getBean("serviceA");
Field h = serviceA.getClass().getDeclaredField("CGLIB$CALLBACK_0");
h.setAccessible(true);
Object dynamicAdvisedInterceptor = h.get(serviceA);
Field advised = dynamicAdvisedInterceptor.getClass().getDeclaredField("advised");
advised.setAccessible(true);
Object target = ((AdvisedSupport)advised.get(dynamicAdvisedInterceptor)).getTargetSource().getTarget();
ServiceA serviceA1= (ServiceA) target;
System.out.println(serviceA1.getServiceB());
```

再看看jdk动态代理情况下：

```java
IServiceA serviceA = (IServiceA) context.getBean("serviceA");
Field h=serviceA.getClass().getSuperclass().getDeclaredField("h");
h.setAccessible(true);
AopProxy aopProxy = (AopProxy) h.get(serviceA);
Field advised = aopProxy.getClass().getDeclaredField("advised");
advised.setAccessible(true);
Object target = ((AdvisedSupport)advised.get(aopProxy)).getTargetSource().getTarget();
ServiceA serviceA1= (ServiceA) target;
System.out.println(serviceA1.getServiceB());
```

执行结果都能获取到serviceB的实例：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fdc4accf670440aea20aa07378da1f1d~tplv-k3u1fbpfcp-zoom-1.image)

对aop情况下的循环依赖进行一下总结：spring专门为了处理aop情况下的循环依赖提供了特殊的解决方案，但是不论是使用jdk动态代理还是cglib代理，都在代理对象的内部包裹了原始对象，在原始对象中才有依赖的属性。此外，如果我们使用了后置处理器对bean进行包装，循环依赖的问题还是不能解决的。

## 总结

最后对本文的重点进行一下总结：

1、spring通过借助三级缓存完成了循环依赖的实现，这个过程中要清楚三级缓存分别在什么场景下发挥了什么具体作用

2、产生aop情况下，调用后置处理器并将生成的代理对象提前曝光，并通过额外的一个缓存避免重复执行aop

3、二级缓存和三级缓存只有在产生循环依赖的情况下，才会真正起到作用

4、此外，除去本文中提到的通过属性的方式注入依赖的情况外，大家可能会好奇如果使用构造函数能否实现循环依赖，结果是不可以的。具体的调用过程这里不再多说，有兴趣的同学可以自己再对照源码进行一下梳理。