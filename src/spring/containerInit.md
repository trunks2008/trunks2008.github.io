---
title: Spring容器初始化源码解析
icon: page
order: 1
author: Hydra
date: 2020-06-16
tag:
  - Spring
star: true
---



<!-- more -->

Spring框架被广泛应用于我们的日常工作中，但是很长时间以来我都是只会使用，不懂它的作用原理。通过最近一段时间的阅读源码，个人发现通过阅读源码，能够帮助我们了解Spring的设计理念，并且对Java编程中的一些设计模式更加熟悉，所以记录一下自己对Spring源码的理解。

在开始进行源码学习前，首先再回顾一下三种Spring编程风格：

- 基于`Schema`，即通过`xml`标签的配置方式
- 基于`Annotation`的注解技术，使用`@Component`等注解配置bean
- 基于`Java Config`，简单来说就是使用`@Configuration`和`@Bean`进行配置

基于注解的方式需要通过xml或java config来开启。在使用xml时，需要手动开启对注解的支持：

```xml
<context: annotation-config/> 
```

当然，如果在xml中配置了扫描包，现在也可以光添加下面这一行，这行代码中已经包含了注解的开启功能。

```xml
<context: component-sacn base-package="com"/>
```

如果你使用的是下面`AnnotationConfigApplicationContext`这种方式，那么就不需要添加任何操作了，其中已经包含了对注解的支持。

```java
AnnotationConfigApplicationContext ctx
	=new AnnotationConfigApplicationContext(SpringConfig.class);
```

在实际使用过程中，三种方式是可以混合使用的，不存在冲突。按照下面这种方式作为`AnnotationConfigApplicationContext`传入的配置文件，即可实现三种风格的统一使用：

```java
@Configuration
@ComponentScan("com")
@ImportResource("classpath:spring.xml") 
public class SpringConfig{
}
```

之前也有小伙伴对我说，在开始学习Spring的时候，差点因为配置繁杂的xml被劝退，我也翻阅了一下网上spring入门的技术文章，确实很多还是停留在使用xml的方式上。但是其实如果你翻阅一下spring5的官方文档，可以看出官方是推荐我们使用注解的方式的。

尤其是现在的Spring Boot更多的是基于注解，省略了很多配置的过程，对新手更加友好，降低了劝退率，所以本文将基于注解的方式进行源码解析，另外再说明一下本文基于`spring-framework-5.0.x`源码。

使用注解的方式初始化一个Spring环境，只需要下面一行代码：

```java
AnnotationConfigApplicationContext context
    = new AnnotationConfigApplicationContext(SpringConfig.class);
```

如果看一下它的构造方法，那么可以将它做的工作拆分为三步，为了便于理解可以写成下面的形式，并分为三大模块分别进行说明。

## 构造方法

首先看一下`AnnotationConfigApplicationContext`的继承关系：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02b89cca0ae5460aaf5aebdb6b41dcf9~tplv-k3u1fbpfcp-zoom-1.image)

`AnnotationConfigApplicationContext`继承了`GenericApplicationContext`，那么我们先看`GenericApplicationContext`的构造方法：

```java
public GenericApplicationContext() {
  this.beanFactory = new DefaultListableBeanFactory();
}
```

在这里初始化了一个`beanFactory`的实现类`DefaultListableBeanFactory`，这就是我们常提到的spring中重要的bean工厂，这里面存放了很多非常重要的数据结构。这里先列出比较重要的`beanDefinitionMap`，会在后面频繁使用：

```java
private final Map<String, BeanDefinition> beanDefinitionMap = new ConcurrentHashMap<>(256);
private volatile List<String> beanDefinitionNames = new ArrayList<>(256);
```

在上面的这个`beanDefinitionMap`中就维护了`beanName`及`BeanDefinition`的对应关系，`beanDefinitionNames`则是一个存放`beanName`的List。

从`AnnotationConfigApplicationContext`的构造方法开始分析：

```java
public AnnotationConfigApplicationContext() {
  this.reader = new AnnotatedBeanDefinitionReader(this);
  this.scanner = new ClassPathBeanDefinitionScanner(this);
}
```

首先实例化了一个`AnnotatedBeanDefinitionReader`对象，看一下`AnnotatedBeanDefinitionReader`的构造函数：

```java
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry) {
  this(registry, getOrCreateEnvironment(registry));
}
```

那么，为什么在这能够将`AnnotationConfigApplicationContext`对象作为`BeanDefinitionRegistry`传入呢？

回头看一下继承关系那张图，`AnnotationConfigApplicationContext`继承了`BeanDefinitionRegistry`，并且最终实现了接口`BeanFactory`，`BeanFactory`可以说是Spring中的顶层类，它是一个工厂，能够产生bean对象，提供了一个非常重要的方法getBean，会在后面讲到。

到这，我们可以得出一个结论：

> `BeanDefinitionRegistry`可以等同于`AnnotationConfigApplicationContext` ，看做spring的上下文环境。

`AnnotatedBeanDefinitionReader`在实例化时，会调用`registerAnnotationConfigProcessors`方法。先看前半段代码：

```java
public static Set<BeanDefinitionHolder> registerAnnotationConfigProcessors(
    BeanDefinitionRegistry registry, @Nullable Object source) {
    DefaultListableBeanFactory beanFactory = unwrapDefaultListableBeanFactory(registry);
    if (beanFactory != null) {
      if (!(beanFactory.getDependencyComparator() instanceof AnnotationAwareOrderComparator)) {
        beanFactory.setDependencyComparator(AnnotationAwareOrderComparator.INSTANCE);
      }
      if (!(beanFactory.getAutowireCandidateResolver() instanceof ContextAnnotationAutowireCandidateResolver)) {
        beanFactory.setAutowireCandidateResolver(new ContextAnnotationAutowireCandidateResolver());
      }
}
```

在这里先获取在父类构造函数中实例好的`beanFactory`，并为它填充一些属性：

- `AnnotationAwareOrderComparator`：主要用于排序，解析`@order`和`@Priority`注解
- `ContextAnnotationAutowireCandidateResolver`：提供处理延迟加载的功能

再看后半段代码，下面生成了6个重要类的`BeanDefinitionHolder`，并存放到一个Set中：

```java
 Set<BeanDefinitionHolder> beanDefs = new LinkedHashSet<>(8);
    if (!registry.containsBeanDefinition(CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(ConfigurationClassPostProcessor.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(AUTOWIRED_ANNOTATION_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(AutowiredAnnotationBeanPostProcessor.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, AUTOWIRED_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(REQUIRED_ANNOTATION_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(RequiredAnnotationBeanPostProcessor.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, REQUIRED_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    // Check for JSR-250 support, and if present add the CommonAnnotationBeanPostProcessor.
    if (jsr250Present && !registry.containsBeanDefinition(COMMON_ANNOTATION_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(CommonAnnotationBeanPostProcessor.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, COMMON_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    // Check for JPA support, and if present add the PersistenceAnnotationBeanPostProcessor.
    if (jpaPresent && !registry.containsBeanDefinition(PERSISTENCE_ANNOTATION_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition();
      try {
        def.setBeanClass(ClassUtils.forName(PERSISTENCE_ANNOTATION_PROCESSOR_CLASS_NAME,
            AnnotationConfigUtils.class.getClassLoader()));
      }
      catch (ClassNotFoundException ex) {
        throw new IllegalStateException(
            "Cannot load optional framework class: " + PERSISTENCE_ANNOTATION_PROCESSOR_CLASS_NAME, ex);
      }
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, PERSISTENCE_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(EVENT_LISTENER_PROCESSOR_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(EventListenerMethodProcessor.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, EVENT_LISTENER_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(EVENT_LISTENER_FACTORY_BEAN_NAME)) {
      RootBeanDefinition def = new RootBeanDefinition(DefaultEventListenerFactory.class);
      def.setSource(source);
      beanDefs.add(registerPostProcessor(registry, def, EVENT_LISTENER_FACTORY_BEAN_NAME));
    }

    return beanDefs;
  }
```

这里是使用`RootBeanDefinition`来将普通类转换为`BeanDefinition`，并进一步封装成`BeanDefinitionHolder`。封装成`BeanDefinitionHolder`的操作在`registerPostProcessor`方法中：

```java
 private static BeanDefinitionHolder registerPostProcessor(
      BeanDefinitionRegistry registry, RootBeanDefinition definition, String beanName) {
    definition.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
    registry.registerBeanDefinition(beanName, definition);
    return new BeanDefinitionHolder(definition, beanName);
  }
```

通过`registerBeanDefinition`方法将`BeanDefinition`注册到spring环境中，这个操作其实就是执行了上面的`beanDefinitionMap`的`put`操作：

```java
this.beanDefinitionMap.put(beanName, beanDefinition);
```

在上面的操作全部完成后，在还没有实例化用户自定义的bean前，已经有了6个spring自己定义的`beanDefinition`，用于实现spring自身的初始化：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c53d577d3b14df9bb305af716b8ad9c~tplv-k3u1fbpfcp-zoom-1.image)

这里有必要对`BeanDefinition`进行一下说明，它是对具有属性值的`bean`实例的一个说明，或者说是定义。就像是在java类加载的过程，普通java文件要先生成字节码文件，再加载到jvm中生成`class`对象，spring初始化过程中首先要将普通类转化为`BeanDefinition`，然后再实例化为bean。

在实例化`AnnotatedBeanDefinitionReader`完成后，实例化了一个`ClassPathBeanDefinitionScanner`，可以用来扫描包或者类，并将扫描到的类转化为`BeanDefinition`。但是翻阅源码，我们可以看到实际上扫描包的工作不是这个`scanner`对象来完成的，而是在后面spring自己实例化了一个`ClassPathBeanDefinitionScanner`来负责的。

这里的`scanner`仅仅是对外提供一个扩展，可以让我们能够在外部调用`AnnotationConfigApplicationContext`对象的`scan`方法，实现包的扫描，例如：

```java
context.scan("com.hydra");
```

到这里，`AnnotationConfigApplicationContext`的构造函数就执行完了，下面，我们来详细说说接下来被调用的`register`方法。

## register方法

到上面位为止，`AnnotationConfigApplicationContext`构造函数执行完毕，调用`register`方法注册配置类，实际执行方法`doRegisterBean`：

```java
  <T> void doRegisterBean(Class<T> annotatedClass, @Nullable Supplier<T> instanceSupplier, @Nullable String name,
      @Nullable Class<? extends Annotation>[] qualifiers, BeanDefinitionCustomizer... definitionCustomizers) {
    AnnotatedGenericBeanDefinition abd = new AnnotatedGenericBeanDefinition(annotatedClass);
    //判断这个类是否需要解析，主要根据注解进行判断
    if (this.conditionEvaluator.shouldSkip(abd.getMetadata())) {
      return;
    }
    abd.setInstanceSupplier(instanceSupplier);
    //得到类的作用域
    ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(abd);
    //把类的作用域添加到数据结构中
    abd.setScope(scopeMetadata.getScopeName());
    //生成类的名字，通过beanNameGenerator
    String beanName = (name != null ? name : this.beanNameGenerator.generateBeanName(abd, this.registry));
    AnnotationConfigUtils.processCommonDefinitionAnnotations(abd);

    if (qualifiers != null) {
      for (Class<? extends Annotation> qualifier : qualifiers) {
        if (Primary.class == qualifier) {
          abd.setPrimary(true);
        }
        else if (Lazy.class == qualifier) {
          abd.setLazyInit(true);
        }
        else {
          abd.addQualifier(new AutowireCandidateQualifier(qualifier));
        }
      }
    }
    for (BeanDefinitionCustomizer customizer : definitionCustomizers) {
      customizer.customize(abd);
    }
  
    BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(abd, beanName);
    definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
    BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry);
  }
```

在上面这段代码中，主要完成这几项任务：

- 首先根据我们传入的类创建一个`AnnotatedGenericBeanDefinition`，它可以理解为一个数据结构，其中包含了类的一些元信息，例如作用域`scope`，懒加载`lazy`等属性。
- 调用`processCommonDefinitionAnnotations`方法，处理类中的通用注解，分析源码得知处理了`Lazy`,`DependsOn`,`Primary`,`Role`等注解，处理完成后把它们添加到数据结构中。
- 封装成`BeanDefinitionHolder`，`BeanDefinitionHolder`可以简单的理解为一个`Map`，它关联`BeanDefinition`和`beanName`。
- 调用`registerBeanDefinition`方法，将上面的`BeanDefinitionHolder`注册给`registry`，这个`registry`就是 `AnnotationConfigApplicationContext`，即`BeanDefinitionRegistry`。

```java
  public void registerBeanDefinition(String beanName, BeanDefinition beanDefinition)
      throws BeanDefinitionStoreException {
    this.beanFactory.registerBeanDefinition(beanName, beanDefinition);
  }
```

这里最终将`beanDefinition`注册给了之前实例化的`beanFactory`，`beanFactory`的实现类为`DefaultListableBeanFactory`。

到这，我们已经有两种方法将一个类转化为`BeanDefinition`：

1、通过`RootBeanDefinition` 的构造方法

2、调用`AnnotatedBeanDefinitionReader`的`register`方法

执行完这一步后，可以看到我们的配置类也被放入了`beanDefinitionMap`，到这里，spring的工厂初始化工作就完成了。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea18c3b3e85f4510ac55d5b23586b899~tplv-k3u1fbpfcp-zoom-1.image)

## refresh 方法

注册完成后，调用核心方法`refresh`，初始化spring环境：

```java
public void refresh() throws BeansException, IllegalStateException {
    synchronized (this.startupShutdownMonitor) {
      prepareRefresh();
      ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();
      prepareBeanFactory(beanFactory);
      try {
        postProcessBeanFactory(beanFactory);
        invokeBeanFactoryPostProcessors(beanFactory);
        registerBeanPostProcessors(beanFactory);
        initMessageSource();
        initApplicationEventMulticaster();
        onRefresh();
        registerListeners();
        finishBeanFactoryInitialization(beanFactory);
        finishRefresh();
      }
  ...
}
```

首先可以看到，方法中的代码是被`synchronized`加锁的，这样做是为了防止一个线程在执行`refresh`时，其他线程执行spring容器的启动或销毁操作。下面，我们开始分析一下其中重要的方法，重要的注释会写在代码中。

### 1、prepareRefresh

`prepareRefresh`方法中为一些启动的准备工作，包括记录启动时间，是否激活标识位，初始化属性源配置等工作

```java
protected void prepareRefresh() {
    // 记录启动时间
    this.startupDate = System.currentTimeMillis();
    // closed 属性设置为 false
    this.closed.set(false);
    //将 active 属性设置为 true
    //上面两个都是 AtomicBoolean类型
    this.active.set(true);

    if (logger.isInfoEnabled()) {
      logger.info("Refreshing " + this);
    }
    //注解模式下此方法为空
    initPropertySources();
    getEnvironment().validateRequiredProperties();
     ...
  }
```

### 2、obtainFreshBeanFactory

返回我们之前创建好的`DefaultListableBeanFactory`实例`beanFactory`，这里使用的是它的接口`ConfigurableListableBeanFactory`来进行接收。

```java
protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
    refreshBeanFactory();
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    if (logger.isDebugEnabled()) {
      logger.debug("Bean factory for " + getDisplayName() + ": " + beanFactory);
    }
    return beanFactory;
  }
```

这里进行一下补充，如果是基于xml的配置，那么是在`obtainFreshBeanFactory`方法中初始化`BeanFactory`工厂的，并进行bean的加载与注册，这里不再赘述。

### 3、prepareBeanFactory

准备bean工厂，对功能进行填充，例如配置了一些标准特征，比如上下文的加载器`ClassLoader`和`postProcessor`后置处理器。

```java
  protected void prepareBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    beanFactory.setBeanClassLoader(getClassLoader());
    //bean表达式的解释器
    beanFactory.setBeanExpressionResolver(new StandardBeanExpressionResolver(beanFactory.getBeanClassLoader()));
    //bean对象与String类型的转换，例如<property ref="dao">
    beanFactory.addPropertyEditorRegistrar(new ResourceEditorRegistrar(this, getEnvironment()));    
    //spring核心代码，添加一个后置管理器
    //能在bean中获得到各种的*Aware
    beanFactory.addBeanPostProcessor(new ApplicationContextAwareProcessor(this));
    //添加了自动注入的忽略列表
    beanFactory.ignoreDependencyInterface(EnvironmentAware.class);
    beanFactory.ignoreDependencyInterface(EmbeddedValueResolverAware.class);
    beanFactory.ignoreDependencyInterface(ResourceLoaderAware.class);
    beanFactory.ignoreDependencyInterface(ApplicationEventPublisherAware.class);
    beanFactory.ignoreDependencyInterface(MessageSourceAware.class);
    beanFactory.ignoreDependencyInterface(ApplicationContextAware.class);

    // BeanFactory interface not registered as resolvable type in a plain factory.
    // MessageSource registered (and found for autowiring) as a bean.
    beanFactory.registerResolvableDependency(BeanFactory.class, beanFactory);
    beanFactory.registerResolvableDependency(ResourceLoader.class, this);
    beanFactory.registerResolvableDependency(ApplicationEventPublisher.class, this);
    beanFactory.registerResolvableDependency(ApplicationContext.class, this);

    //添加一个用于ApplicationListener的bean从事件广播器中添加或删除的后置处理器
    beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(this));
    
    if (beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
      beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
      beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }    
    /*
    * 如果自定义的bean中没有名为“systemProperties”和“systemEnvironment”的Bean
    * 则注册两个bean，key为“systemProperties”和“systemEnvironment”，Value为Map
    * 这两个bean就是一些系统配置和系统环境信息
    * */
    if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
      beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
    }
    if (!beanFactory.containsLocalBean(SYSTEM_PROPERTIES_BEAN_NAME)) {
      beanFactory.registerSingleton(SYSTEM_PROPERTIES_BEAN_NAME, getEnvironment().getSystemProperties());
    }
    if (!beanFactory.containsLocalBean(SYSTEM_ENVIRONMENT_BEAN_NAME)) {
      beanFactory.registerSingleton(SYSTEM_ENVIRONMENT_BEAN_NAME, getEnvironment().getSystemEnvironment());
    }
  }
```

需要说明的是添加后置处理器`addBeanPostProcessor`方法，在`beanFactory`中维护了一个spring后置处理器的列表：

```java
private final List<BeanPostProcessor> beanPostProcessors = new CopyOnWriteArrayList<>();
```

最终调用的是List的`add`方法，将后置处理器添加到列表的尾部：

```java
this.beanPostProcessors.add(beanPostProcessor);
```

这里有必要简单的对`BeanPostProcessor`进行一下说明：

```java
public interface BeanPostProcessor {
  @Nullable
  default Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
    return bean;
  }
  @Nullable
  default Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
    return bean;
  }
}
```

`postProcessBeforeInitialization`在类的初始化之前执行，`postProcessAfterInitialization`在类的初始化之后执行。也就是说spring通过暴露出`BeanPostProcessor`这个后置处理器，可以让我们去插手bean的初始化过程。

`ApplicationContextAwareProcessor`实现了这个接口，通过它spring向外暴露了上下文环境`ApplicationContext`，供我们调用。

### 4、postProcessBeanFactory

`postProcessBeanFactory`是一个空的方法，没有任何实现：

```java
  /**
   * Modify the application context's internal bean factory after its standard
   * initialization. All bean definitions will have been loaded, but no beans
   * will have been instantiated yet. This allows for registering special
   * BeanPostProcessors etc in certain ApplicationContext implementations.
   * @param beanFactory the bean factory used by the application context
   */
protected void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
}
```

看一下源码中的注释，可理解可以通过子类扩展当前类，添加一些`BeanPostProcessor`，在`BeanDefinition`被加载但bean还没有实例化前，执行这些特殊的后置管理器进行功能扩展。

### 5、invokeBeanFactoryPostProcessors

在该方法中，执行已被注册的`BeanFactoryPostProcessor`。`BeanFactoryPostProcessor`也是spring提供的扩展点之一，它运行于spring容器加载了`beanDefinition`之后，但还未实例化bean之前执行。通过实现这个接口，可以在bean创建之前修改`beanDefinition`的属性，并且可以同时配置多个`BeanFactoryProcessor`，通过设置`order`属性来控制顺序。

```java
@FunctionalInterface
public interface BeanFactoryPostProcessor {
  void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException;
}
```

再来看看`invokeBeanFactoryPostProcessors`方法：

```java
protected void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors(beanFactory, getBeanFactoryPostProcessors());   
    if (beanFactory.getTempClassLoader() == null && beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
      beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
      beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }
  }
```

这个需要注意的是`getBeanFactoryPostProcessors`方法，这个方法是获取手动注册给spring添加的`BeanFactoryPostProcessor`，这个“手动注册”并不是说写好了以后添加一个`@Component`注解就可以了，因为如果加了注解还是spring自己去扫描得到的。

看一下`getBeanFactoryPostProcessors`方法，就可以知道是这里直接返回了一个List：

```java
  public List<BeanFactoryPostProcessor> getBeanFactoryPostProcessors() {
    return this.beanFactoryPostProcessors;
  }
```

而通过 `AnnotationConfigApplicationContext`的`addBeanFactoryPostProcessor`方法进行添加，则直接添加进了这个list中：

```java
public void addBeanFactoryPostProcessor(BeanFactoryPostProcessor postProcessor) {
    Assert.notNull(postProcessor, "BeanFactoryPostProcessor must not be null");
    this.beanFactoryPostProcessors.add(postProcessor);
  }
```

回到代码中，调用执行了`PostProcessorRegistrationDelegate`的`invokeBeanFactoryPostProcessors` 方法，这个方法用于执行所有注册的`BeanFactoryPostProcessor`。该方法中，创建一个List存放spring内部自己实现了`BeanDefinitionRegistryPostProcessor`接口的对象，并从`beanFactory`中获取这个`type`的bean的名称：

```java
List<BeanDefinitionRegistryPostProcessor> currentRegistryProcessors = new ArrayList<>();
String[] postProcessorNames =
          beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
```

此处，我们可以得到一个对应的`beanName`：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/31e6a0a6d7114937b2977ecaa0e7a0e6~tplv-k3u1fbpfcp-zoom-1.image)

在获取到`beanName`后，通过bean工厂的`getBean`方法将其实例化，并添加到`currentRegistryProcessors`中，然后调用`invokeBeanDefinitionRegistryPostProcessors`方法，执行所有的`BeanDefinitionRegistryPostProcessor`：

```java
for (String ppName : postProcessorNames) {
  if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
    currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
    processedBeans.add(ppName);
  }
}
sortPostProcessors(currentRegistryProcessors, beanFactory);
//合并list
registryProcessors.addAll(currentRegistryProcessors);
invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);
//清除list
currentRegistryProcessors.clear();
```

看一下`currentRegistryProcessors`中的实例，这个对象非常重要，会在后面讲到：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/45fbf41b7eb74f9ab6fb13e702613ea1~tplv-k3u1fbpfcp-zoom-1.image)

回到上面的调用过程，我们知道这个`Collection`中现在只有一个对象，所以调用的是上面提到的 `ConfigurationClassPostProcessor`对象的 `postProcessBeanDefinitionRegistry`方法：

```java
private static void invokeBeanDefinitionRegistryPostProcessors(
      Collection<? extends BeanDefinitionRegistryPostProcessor> postProcessors, BeanDefinitionRegistry registry) {
    for (BeanDefinitionRegistryPostProcessor postProcessor : postProcessors) {      
      postProcessor.postProcessBeanDefinitionRegistry(registry);
    }
  }
```

最终调用`ConfigurationClassPostProcessor`的`processConfigBeanDefinitions`。先看方法的前半段：

```java
public void processConfigBeanDefinitions(BeanDefinitionRegistry registry) {
  //定义一个list，存放beanFactory中的beanDefinition
  List<BeanDefinitionHolder> configCandidates = new ArrayList<>();
  //获取容器中注册的所有beanDefinition的名字，目前有了7个
  String[] candidateNames = registry.getBeanDefinitionNames();
  for (String beanName : candidateNames) {
    BeanDefinition beanDef = registry.getBeanDefinition(beanName);
    if (ConfigurationClassUtils.isFullConfigurationClass(beanDef) ||
        ConfigurationClassUtils.isLiteConfigurationClass(beanDef)) {
      //如果BeanDefinition中的configurationClass的属性为full或者lite，则意味着已经处理过了，直接跳过
      if (logger.isDebugEnabled()) {
        logger.debug("Bean definition has already been processed as a configuration class: " + beanDef);
      }
    }
    //判断是否Configuration类，如果加了Configuration下面的这几个注解就不再判断了
    else if (ConfigurationClassUtils.checkConfigurationClassCandidate(beanDef, this.metadataReaderFactory)) {
      configCandidates.add(new BeanDefinitionHolder(beanDef, beanName));
    }
  }

  // Return immediately if no @Configuration classes were found
  if (configCandidates.isEmpty()) {
    return;
  }
```

这里先读取了`BeanFactory`中存放的7个`beanDefinition`，然后去判断是否加了以下注解：

```java
@Configuration
@ComponentScan
@Import
@ImportResource
```

如果是，则添加到`configCandidates`的List中，运行到这，可以看到在里面存了一个我们自定义的添加了`@Configuration`注解的类：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ac999209090c4b0886e2ce56ab2d1c81~tplv-k3u1fbpfcp-zoom-1.image)

向下运行，首先实例化了一个`ConfigurationClassParser`，用于解析各个配置类：

```java
ConfigurationClassParser parser = new ConfigurationClassParser(
        this.metadataReaderFactory, this.problemReporter, this.environment,
        this.resourceLoader, this.componentScanBeanNameGenerator, registry);
```

然后，实例化 2个Set，`candidates` 用于将之前加入的`configCandidates`进行去重，因为有可能有多个配置类重复了。`alreadyParsed `用于判断是否处理过，避免重复。

```java
Set<BeanDefinitionHolder> candidates = new LinkedHashSet<>(configCandidates);
Set<ConfigurationClass> alreadyParsed = new HashSet<>(configCandidates.size());
```

调用`ConfigurationClassParser`的`parse`方法：

 ```java
do {
      parser.parse(candidates);
      ...
}
while (!candidates.isEmpty());
 ```

`parse`方法调用链较长，这里只列出其调用过程和重要扫描过程：

```properties
ConfigurationClassParser 
# parse(Set<BeanDefinitionHolder> configCandidates)
# parse(AnnotationMetadata metadata, String beanName)
# processConfigurationClas(ConfigurationClass configClass)
# doProcessConfigurationClass(ConfigurationClass configClass, SourceClass sourceClass)
```

重点看一下`doProcessConfigurationClass`方法：

```java
Set<AnnotationAttributes> componentScans = AnnotationConfigUtils.attributesForRepeatable(
      sourceClass.getMetadata(), ComponentScans.class, ComponentScan.class);
```

得到注解类的注解信息，例如`basePackage`等，存放在`AnnotationAttributes`中。之后对`set`进行遍历：

```java
for (AnnotationAttributes componentScan : componentScans) {
  //扫描普通类，会扫描出来所有加了@Component注解的类
  //并且把扫描出来的普通bean放到map当中
  Set<BeanDefinitionHolder> scannedBeanDefinitions =
      this.componentScanParser.parse(componentScan, sourceClass.getMetadata().getClassName());
  //这一步完成后扫描出来了所有类
  //检查扫描出的类是否还有 @Configuration
  for (BeanDefinitionHolder holder : scannedBeanDefinitions) {
    BeanDefinition bdCand = holder.getBeanDefinition().getOriginatingBeanDefinition();
    if (bdCand == null) {
      bdCand = holder.getBeanDefinition();
    }
    if (ConfigurationClassUtils.checkConfigurationClassCandidate(bdCand, this.metadataReaderFactory)) {
      parse(bdCand.getBeanClassName(), holder.getBeanName());
    }
  }
}
```

这里的关键还是`parse`方法，调用`ComponentScanAnnotationParser` 的`parse`方法，然后调用`ClassPathBeanDefinitionScanner`的`doScan`方法，实现扫描核心功能：

```java
protected Set<BeanDefinitionHolder> doScan(String... basePackages) {
  Assert.notEmpty(basePackages, "At least one base package must be specified");
  Set<BeanDefinitionHolder> beanDefinitions = new LinkedHashSet<>();
  for (String basePackage : basePackages) {
    //扫描basePackage路径下的java文件
    //并把它转成BeanDefinition类型
    Set<BeanDefinition> candidates = findCandidateComponents(basePackage);

    for (BeanDefinition candidate : candidates) {
      //解析scope属性
      ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(candidate);
      candidate.setScope(scopeMetadata.getScopeName());
      String beanName = this.beanNameGenerator.generateBeanName(candidate, this.registry);

      //所有扫描出来的类 是 ScannedGenericBeanDefinition  ，符合AbstractBeanDefinition
      //先设置默认值
      if (candidate instanceof AbstractBeanDefinition) {
        //如果这个类是AbstractBeanDefinition的子类
        //则为他设置默认值，比如lazy，init ，destroy
        postProcessBeanDefinition((AbstractBeanDefinition) candidate, beanName);
      }
      if (candidate instanceof AnnotatedBeanDefinition) {
        //检查并且处理常用的注解
        //这里的处理主要是指把常用注解的值设置到AnnotatedBeanDefinition当中
        //当前前提是这个类型必须是AnnotatedBeanDefinition类型的，也就是加了注解的类
        AnnotationConfigUtils.processCommonDefinitionAnnotations((AnnotatedBeanDefinition) candidate);
      }
      if (checkCandidate(beanName, candidate)) {
        BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(candidate, beanName);
        definitionHolder =
            AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
        beanDefinitions.add(definitionHolder);
        //加入到BeanDefinitionMap当中
        registerBeanDefinition(definitionHolder, this.registry);
      }
    }
  }
  return beanDefinitions;
}
```

到这，spring已经把所有加了`@Component`类注解的类扫描出来，并生成对应的`beanDefinition`，最后通过`registerBeanDefinition`方法，放入`beanDefinitionMap`中。

到这，我们执行完了`ConfigurationClassPostProcessor`的`invokeBeanDefinitionRegistryPostProcessors`方法。

回到`PostProcessorRegistrationDelegate`的`invokeBeanFactoryPostProcessors`方法中继续向下执行：

```java
invokeBeanFactoryPostProcessors(registryProcessors, beanFactory);
invokeBeanFactoryPostProcessors(regularPostProcessors, beanFactory);
```

第二行语句用于执行我们自定义的`beanFactoryPostProcessor`，由于现在不存在，可以直接忽略，重点看第一条。

有的同学可能会问，刚才不是执行了一条差不多的语句吗，而且这个`registryProcessors`里面的东西也没有变，还是`ConfigurationClassPostProcessor`，那么为什么要执行两遍？看一下继承关系：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a226c04c62b0454a9da2a6c0231b30fd~tplv-k3u1fbpfcp-zoom-1.image)



`BeanDefinitionRegistryPostProcessor`对`BeanFactoryPostProcessor`进行了扩展，添加了自己的方法。所以第一次执行的是：

```properties
BeanDefinitionRegistryPostProcessor # postProcessBeanDefinitionRegistry
```

而第二次执行的方法是：

```properties
BeanFactoryPostProcessor # postProcessBeanFactory
```

这里调用了`ConfigurationClassPostProcessor`的`postProcessBeanFactory`方法：

```java
public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    int factoryId = System.identityHashCode(beanFactory);
    if (this.factoriesPostProcessed.contains(factoryId)) {
      throw new IllegalStateException(
          "postProcessBeanFactory already called on this post-processor against " + beanFactory);
    }
    this.factoriesPostProcessed.add(factoryId);
    if (!this.registriesPostProcessed.contains(factoryId)) {
      // BeanDefinitionRegistryPostProcessor hook apparently not supported...
      // Simply call processConfigurationClasses lazily at this point then.
      processConfigBeanDefinitions((BeanDefinitionRegistry) beanFactory);
    }
   
    enhanceConfigurationClasses(beanFactory);
    beanFactory.addBeanPostProcessor(new ImportAwareBeanPostProcessor(beanFactory));
  }
```

 主要用于给我们的`@Configuration`配置类产生`cglib`代理，并添加一个`ImportAwareBeanPostProcessor`后置处理器，这个后置处理器会在后面实例化bean的过程中用到。

### 6、registerBeanPostProcessors

这一步用于向spring环境中注册`BeanPostProcessors`后置处理器，前面说过，`BeanPostProcessors`的作用是在bean初始化的时候允许我们人工进行插手，当然这里只是进行一个注册的过程，并不会实际执行，具体的执行是bean在初始化的时候。

```java
protected void registerBeanPostProcessors(ConfigurableListableBeanFactory beanFactory) {
  PostProcessorRegistrationDelegate.registerBeanPostProcessors(beanFactory, this);
}
```

调用`registerBeanPostProcessors`方法：

```java
String[] postProcessorNames = beanFactory.getBeanNamesForType(BeanPostProcessor.class, true, false);
int beanProcessorTargetCount = beanFactory.getBeanPostProcessorCount() + 1 + postProcessorNames.length;
beanFactory.addBeanPostProcessor(new BeanPostProcessorChecker(beanFactory, beanProcessorTargetCount));
```

首先从`BeanDefinitionMap`中找出所有实现`BeanPostProcessor`接口的类，并添加了一个`BeanPostProcessorChecker`到`beanFactory`中，主要用于记录信息。

然后，创建了4个List用于缓存不同类型的后置处理器：

```java
//存放实现PriorityOrdered接口的BeanPostProcessor
List<BeanPostProcessor> priorityOrderedPostProcessors = new ArrayList<>();
//存放Spring内部的BeanPostProcesso
List<BeanPostProcessor> internalPostProcessors = new ArrayList<>();
//存放注册实现Ordered接口的BeanPostProcessors
List<BeanPostProcessor> orderedPostProcessors = new ArrayList<>();
//存放常规的BeanPostProcessors
List<BeanPostProcessor> nonOrderedPostProcessors = new ArrayList<>();
```

对4个List分别调用`PostProcessorRegistrationDelegate`的`registerBeanPostProcessors`方法：

```java
private static void registerBeanPostProcessors(
      ConfigurableListableBeanFactory beanFactory, List<BeanPostProcessor> postProcessors) {
    for (BeanPostProcessor postProcessor : postProcessors) {
      beanFactory.addBeanPostProcessor(postProcessor);
    }
  }
```

遍历列表，调用`AbstractBeanFactory`的`addBeanPostProcessor`方法，将后置处理器加到`beanPostProcessors`中：

```java
 public void addBeanPostProcessor(BeanPostProcessor beanPostProcessor) {
    Assert.notNull(beanPostProcessor, "BeanPostProcessor must not be null");
    // 如果beanPostProcessor已经存在则移除
    this.beanPostProcessors.remove(beanPostProcessor);   
    // beanFactory是否已注册过InstantiationAwareBeanPostProcessors
    if (beanPostProcessor instanceof InstantiationAwareBeanPostProcessor) {
      this.hasInstantiationAwareBeanPostProcessors = true;
    }
    //beanFactory是否已注册过DestructionAwareBeanPostProcessor
    if (beanPostProcessor instanceof DestructionAwareBeanPostProcessor) {
      this.hasDestructionAwareBeanPostProcessors = true;
    }
    //将beanPostProcessor添加到beanPostProcessors中
    this.beanPostProcessors.add(beanPostProcessor);
  }
```

在这个方法中，如果`beanPostProcessor`已经存在则移除，这样做可以起到重排序的作用，如果`beanPostProcessor`原先在前面，经过删除后再添加，则变到最后面。到这，将所有实现了`BeanPostProcessor`接口的类加载到 `BeanFactory` 中。

### 7、非重点部分

以下部分是非重点部分，不需要过分关注，因此省略，只做一个大体的注释说明：

```java
//初始化上下文的 MessageSource源
initMessageSource();
//初始化应用事件广播器
initApplicationEventMulticaster();
//空方法，可用做子类扩展
onRefresh();
//在所有注册的bean中查找Listener bean,注册到消息广播器中
registerListeners();
```

至此，Spring环境的初始化工作就做完了，但是bean还没有被创建出来，下篇文章，我们讲讲Spring中bean的实例化过程。