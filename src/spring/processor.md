---
title: Spring后置处理器大盘点
icon: page
order: 5
author: Hydra
date: 2021-05-17
tag:
  - Spring
star: true
---



<!-- more -->

在前面几篇文章中梳理了Spring中bean的创建过程，在这个过程中各式各样的后置处理器发挥了不同的作用，可以说后置处理器贯穿了bean的实例化以及初始化过程。在这篇文章中，将按照出场顺序对后置处理器作用场景及发挥功能进行梳理。

### 1、InstantiationAwareBeanPostProcessor的postProcessBeforeInstantiation()方法

`AbstractAutowireCapableBeanFactory` 的`createBean`方法中调用，这时bean还没有被实例化：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/79d4c134cdc140aab30abdca44bc9668~tplv-k3u1fbpfcp-zoom-1.image)

调用`resolveBeforeInstantiation`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cccba6094060429aa7cb6e1dd2b54620~tplv-k3u1fbpfcp-zoom-1.image)

`applyBeanPostProcessorsBeforeInstantiation`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2b574c2aaefe40779ae0ac0f6c6138f9~tplv-k3u1fbpfcp-zoom-1.image)

在这里，首先拿到spring中提供的所有后置处理器，判断是不是`InstantiationAwareBeanPostProcessor`。该后置处理器实现了`BeanPostProcessor`，在这调用了`postProcessBeforeInstantiation`方法。

这里在目标对象被spring实例化之前调用，`postProcessBeforeInstantiation`方法的返回值类型是`Object`，可以返回任何类型的值。由于此时目标对象还未实例化，所以这个返回值可以用来代替原本该生成的目标对象的实例，一般为代理对象。

如果该方法的返回的`Object`对象代替了原本该生成的目标对象，那么就会把返回的对象放到单例池当中缓存，后续只有`BeanPostProcessor`的`postProcessAfterInitialization`方法会调用，其它方法不再调用。

如果这里返回了`null`，就按照正常的流程创建对象，交给spring去负责对象的实例化。因此这个方法可以判断这个对象在spring实例化之前是否要做特殊的处理，比如不交给Spring管理，自己使用代理产生。

### 2、SmartInstantiationAwareBeanPostProcessor的determineCandidateConstructors()方法

在`AbstractAutowireCapableBeanFactory` 的`createBeanInstance`方法中调用：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7fb03cd993194905876339d493adbe01~tplv-k3u1fbpfcp-zoom-1.image)

`determineConstructorsFromBeanPostProcessors`方法，该方法用于推断实例化的构造方法，这里可能检测出bean拥有多个候选构造方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a6ecfe8cf2f24c6ab44b15c767277c42~tplv-k3u1fbpfcp-zoom-1.image)

`SmartInstantiationAwareBeanPostProcessor`接口的实现类`AutowiredAnnotationBeanPostProcessor`负责完成这个过程，如果有多个构造方法的情况下，`ctors`会返回空，后续使用默认无参构造方法进行实例化。但是如果有一个构造方法上有`@Autowired`注解，spring会优先选择这个方法。

### 3、MergedBeanDefinitionPostProcessor的postProcessMergedBeanDefinition()方法

`AbstractAutowireCapableBeanFactory`的`doCreateBean`方法中调用：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e504ebb5ead047d497508521a2f862cd~tplv-k3u1fbpfcp-zoom-1.image)

`applyMergedBeanDefinitionPostProcessors`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03f5641c52aa47d7bb87109b7f05e615~tplv-k3u1fbpfcp-zoom-1.image)

在方法中对所有实现了`MergedBeanDefinitionPostProcessor`接口的后置处理器进行遍历，这里具体调用`AutowiredAnnotationBeanPostProcessor`，用于扫描需要注入的属性。

`AutowiredAnnotationBeanPostProcessor`中，定义了两种需要扫描的注解类型，`@Autowired`和`@Value`

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/91f94e64296844da973b6ead2d21ec85~tplv-k3u1fbpfcp-zoom-1.image)

在`findAutowiredAnnotation`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d42587cb09cb4291b56639ff582badac~tplv-k3u1fbpfcp-zoom-1.image)

对正在创建的bean进行扫描，如果有属性和方法上面加了这两个注解，就会把对应的方法或者属性保存，最终在`buildAutowiringMetadata`方法中封装成`InjectionMetadata`对象。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e21082ca652640e684c37c2651af25bb~tplv-k3u1fbpfcp-zoom-1.image)

需要注意这里的后置处理器仅仅用于扫描及缓存bean的注入信息，这里只完成了查找功能，没有完成属性的注入，属性的注入是在之后的另外的后置处理器中完成的。

### 4、SmartInstantiationAwareBeanPostProcessor的getEarlyBeanReference()方法

在`AbstractAutowireCapableBeanFactory`的`doCreateBean` 方法中调用，主要用于处理Bean的循环依赖：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2151745e9e624e76a9c4a24230608f0f~tplv-k3u1fbpfcp-zoom-1.image)

在产生循环依赖后调用`getEarlyBeanReference`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f0f78e1a92df41cbb8a967c2f841510f~tplv-k3u1fbpfcp-zoom-1.image)

在这里遍历后置处理器，得到经过后置处理器代理后的对象，放入spring的二级缓存当中，提前暴露供循环引用的情况调用。注意这里返回的仅仅是一个对象，还算不上是一个完整的bean对象。这个具体调用过程在上一篇讲循环依赖的中的文章中讲的比较详细，如果有不明白的可以回顾一下。


### 5、InstantiationAwareBeanPostProcessor的postProcessAfterInstantiation()方法

在`AbstractAutowireCapableBeanFactory`的`populateBean`方法中调用：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b70c5002bea749b284cfecdcaab68a2f~tplv-k3u1fbpfcp-zoom-1.image)

在`populateBean`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80e14d6a2bc84791811e013958a8d42a~tplv-k3u1fbpfcp-zoom-1.image)

该方法在目标对象实例化之后调用，这个时候对象已经被实例化，但是该实例的属性还未被设置，都是`null`。

这里遍历后置处理器，如果实现了`InstantiationAwareBeanPostProcessor`，那么就调用`postProcessAfterInstantiation`方法。如果方法返回值为`true`，按照正常流程进行属性值的填充；如果该方法返回`false`，会忽略属性值的设置过程。简而言之，该后置处理器用于判断当前实例化完成的bean需不需要进行属性填充。

### 6、InstantiationAwareBeanPostProcessor的postProcessPropertyValues()方法

同样在`populateBean`方法中，在`postProcessAfterInstantiation`后返回`true`时执行，如果方法返回`false`，该方法不会被调用。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4dd25d769f5248ecb4f7d929bc466a36~tplv-k3u1fbpfcp-zoom-1.image)

遍历后置处理器，如果属于`InstantiationAwareBeanPostProcessor`类型，则调用它的`postProcessPropertyValues`方法。

这里发挥作用的是`AutowiredAnnotationBeanPostProcessor`，负责对添加了 `@Autowired`和`@Value`等注解的属性进行依赖的填充。在其中遍历所有需要注入的属性的列表，使用反射将注入的bean实例赋值给属性。（具体过程参照Spring实例化Bean源码解析）

### 7、BeanPostProcessor的postProcessBeforeInitialization()方法

`AbstractAutowireCapableBeanFactory的doCreateBean`方法中调用`initializeBeanfan`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02ff899839c84ff9858ed2b32da1c74d~tplv-k3u1fbpfcp-zoom-1.image)

`applyBeanPostProcessorsBeforeInitialization`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f49d4bdab92d4894b5563adb9551260b~tplv-k3u1fbpfcp-zoom-1.image)

在该方法中，遍历执行所有`BeanPostProcessor`的`postProcessBeforeInitialization`方法。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e07ba46caf8433f903f264f57d3c63d~tplv-k3u1fbpfcp-zoom-1.image)

在执行该方法前，bean已经被实例化完成，并且完成了属性的填充，因此这个过程属于后续的bean的初始化过程。

需要注意的是，如果在bean中有方法被标注了`@PostContrust`注解，那么在`CommonAnnotationBeanPostProcessor`中，会调用该`@PostContrust`方法。

### 8、BeanPostProcessor的postProcessAfterInitialization()方法

和第7次调用入口相同，也是在`AbstractAutowireCapableBeanFactory`的`initializeBean`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df5894eadd9c4f4d8e4d7f4de9d474f2~tplv-k3u1fbpfcp-zoom-1.image)

`applyBeanPostProcessorsAfterInitialization`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6da2529a64ec495d8d59696d54a3c1e4~tplv-k3u1fbpfcp-zoom-1.image)

遍历执行所有`BeanPostProcessor`的`postProcessAfterInitialization`方法。综上所述，bean的各种方法执行属性为，先执行构造方法，再执行后置管理器中的`before`方法及`@PostContrust`方法，最后执行后置处理器的`after`方法。

### 9、InitDestroyAnnotationBeanPostProcessor的postProcessBeforeDestruction()方法

如果当前bean中有方法被`@PreDestroy`注解标注，那么当Spring的`ApplicationContext`执行`close`方法时调用该后置处理器。在`DefaultSingletonBeanRegistry`中执行`destroyBean`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b05c8d93395e4e8cabf8de73937cdeb4~tplv-k3u1fbpfcp-zoom-1.image)

调用`destroy`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4c64a8d96b246f1bedef3d8331a666b~tplv-k3u1fbpfcp-zoom-1.image)

`InitDestroyAnnotationBeanPostProcessor`的`postProcessBeforeDestruction`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e69a6bb1e3c1445abc9564eae0516220~tplv-k3u1fbpfcp-zoom-1.image)

在该方法中，调用`@PreDestroy`注解标注的方法，执行销毁方法。

### 总结

本文对贯穿bean的实例化及初始化过程中出现的后置处理器进行了一下梳理，但是还有很多其他的后置处理器没有讲到。可以说后置处理器是spring提供给使用者的一些扩展点，如果能够熟练的使用这些后置处理器，能够帮助我们接触到一些spring中比较深层的东西，并对spring中的生命周期进行有利的插手。