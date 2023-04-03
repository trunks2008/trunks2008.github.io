---
title: Spring实例化Bean源码解析
icon: page
order: 2
author: Hydra
date: 2020-06-18
tag:
  - Spring
  - Bean
star: true
---



<!-- more -->

在前一篇文章中，我们说完了Spring环境初始化的过程，接下来讲一下Bean的实例化过程。这篇文章中，暂时不对Bean循环依赖的情况进行分析，因为比较复杂，会放在后面单独的文章中进行分析。

## 准备工作

接着从上篇文章中没有讲完的`AnnotationConfigApplicationContext`类的`refresh`方法开始分析，从下面这条语句开始：

```java
// Instantiate all remaining (non-lazy-init) singletons.
finishBeanFactoryInitialization(beanFactory);
```

从官方的注释可以看出，这里是用来完成所有非懒加载的bean的实例化过程。

我们先写一个简单的bean用于进行测试，其中的`Dao`也是一个交给spring管理的bean。spring会扫描到这个类，并添加到`beanDefinitionMap`和`BeanDefinitionNames`中：

```java
@Component
public class MyService {
  @Autowired
  private Dao dao;

  public void query(){
    System.out.println("executing query method");
    dao.query();
  }
}
```

看一下`finishBeanFactoryInitialization`中的代码：

```java
protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory beanFactory) {
  //如果bdMap中存在conversionService，则进行初始化
  //该bean可用来提供数据的转化功能
  if (beanFactory.containsBean(CONVERSION_SERVICE_BEAN_NAME) &&
      beanFactory.isTypeMatch(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class)) {
    beanFactory.setConversionService(
        beanFactory.getBean(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class));
  }
  if (!beanFactory.hasEmbeddedValueResolver()) {
    beanFactory.addEmbeddedValueResolver(strVal -> getEnvironment().resolvePlaceholders(strVal));
  }
  //初始化类型为LoadTimeWeaverAware的bean
  //可用于AspectJ静态织入过程
  String[] weaverAwareNames = beanFactory.getBeanNamesForType(LoadTimeWeaverAware.class, false, false);
  for (String weaverAwareName : weaverAwareNames) {
    getBean(weaverAwareName);
  }
  //销毁之前在prepareBeanFactory()中生成的临时ClassLoader
  beanFactory.setTempClassLoader(null);
  //在这冻结对BeanDefinition的修改
  //防止spring在初始化的时候发生BeanDefinition的修改
  beanFactory.freezeConfiguration();
  beanFactory.preInstantiateSingletons();
}
```

这个方法中，前面都是在做一些准备工作，直到最后执`beanFactory`的`preInstantiateSingletons`方法，才开始准备执行非懒加载的bean的实例化过程。先看`preInstantiateSingletons`方法的前半段：

```java
public void preInstantiateSingletons() throws BeansException {
  if (logger.isDebugEnabled()) {
    logger.debug("Pre-instantiating singletons in " + this);
  }
  //得到所有bean的名字
  List<String> beanNames = new ArrayList<>(this.beanDefinitionNames);
  for (String beanName : beanNames) {
    //做了合并父类的BeanDefinition的操作
    //在会用xml配置bean时 有一个parent 属性，可以继承类名，作用域等 
    RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);
    if (!bd.isAbstract() && bd.isSingleton() && !bd.isLazyInit()) {
      //判断是FactoryBean
      if (isFactoryBean(beanName)) {
        //如果是FactoryBean则加上 &
        Object bean = getBean(FACTORY_BEAN_PREFIX + beanName);
        if (bean instanceof FactoryBean) {
          final FactoryBean<?> factory = (FactoryBean<?>) bean;
          boolean isEagerInit;
          if (System.getSecurityManager() != null && factory instanceof SmartFactoryBean) {
            isEagerInit = AccessController.doPrivileged((PrivilegedAction<Boolean>)
                    ((SmartFactoryBean<?>) factory)::isEagerInit,
                getAccessControlContext());
          }
          else {
            isEagerInit = (factory instanceof SmartFactoryBean &&
                ((SmartFactoryBean<?>) factory).isEagerInit());
          }
          if (isEagerInit) {
            getBean(beanName);
          }
        }
      }
      else { //不是factoryBean的情况
        getBean(beanName);
      }
    }
  }
  ...
```

首先从`beanDefinitionNames`的List中拿到所有的`beanName`，进行遍历。之前讲过`DefaultListableBeanFactory`内部缓存了一个`beanDefinitionMap的Map`，和这个`beanDefinitionNames`的List，从这也可以看出，通过适当的冗余可以一定程度上减少编码中的工作量。

在对bean进行初始化前包含3个条件：不能为抽象类、单例bean、以及非懒加载。非常好理解不再多说，重点说明一下通过`isFactoryBean`方法判断bean是否`Factorybean`。`Factorybean`是一个比较特殊的bean，并且受spring容器管理，看一下接口定义：

```java
public interface FactoryBean<T> {
  T getObject() throws Exception;
  Class<?> getObjectType();
  default boolean isSingleton() {
    return true;
  }
}
```

如果一个类实现了`FactoryBean`接口，那个spring容器中会存在两个对象，一个是`getObject`方法返回的对象，另一个是当前`FactoryBean`对象本身，并且用`&`添加在`beanName`前进行区分。举个例子：

```java
@Component
public class MyFactoryBean implements FactoryBean {
    @Override
    public Object getObject() throws Exception {
        return new TestDao();
    }
    @Override
    public Class<?> getObjectType() {
        return TestDao.class;
    }
}
```

测试：

```java
System.out.println(context.getBean("myFactoryBean"));
System.out.println(context.getBean("&myFactoryBean"));
```

结果：

```java
com.hydra.dao.TestDao@fbd1f6
com.hydra.factorybean.MyFactoryBean@1ce24091
```

对于`FactoryBean`的获取，要在`beanName`前加上一个前缀`&`，然后会先判断是否是`SmartFactoryBean`并且`isEagerInit`为true，如果是才调用`getBean`方法进行初始化。此处内容略过，直接看重要的`getBean`方法：

```java
public Object getBean(String name) throws BeansException {
  return doGetBean(name, null, null, false);
}
```

此处为空方法，继续调用`doGetBean`方法，从这开始为实例化bean的核心流程。

## 实例化bean

为了方便分析，我们将类与方法按照调用顺讯进行编号，方便后面解析流程的分析。

### 1、AbstractBeanFactory 的 doGetBean方法：

和以前一样，非重点的内容直接在代码中用注释解释。

```java
protected <T> T doGetBean(final String name, @Nullable final Class<T> requiredType,
    @Nullable final Object[] args, boolean typeCheckOnly) throws BeansException {
  final String beanName = transformedBeanName(name);
  Object bean;
  //先尝试从spring容器中获取一次，如果为空则实例化
  Object sharedInstance = getSingleton(beanName);
  //在调用getBean时，args为空
  //如果不为空，那么意味着调用方不是希望获取bean，而是创建bean
  if (sharedInstance != null && args == null) {
    if (logger.isDebugEnabled()) {
      if (isSingletonCurrentlyInCreation(beanName)) {
        logger.debug("Returning eagerly cached instance of singleton bean '" + beanName +
            "' that is not fully initialized yet - a consequence of a circular reference");
      }
      else {
        logger.debug("Returning cached instance of singleton bean '" + beanName + "'");
      }
    }
    /*
    *  如果是普通的单例bean，下面的方法会直接返回sharedInstance
    *  但如果是FactoryBean 类型的，则需要getObject工厂方法获得bean实例
    *  如果想获取FactoryBean本身，也不会做特别的处理
    * */
    bean = getObjectForBeanInstance(sharedInstance, name, beanName, null);
  }
  else {
    //如果当前线程已经创建过了prototype类型的这个bean，抛出异常
    if (isPrototypeCurrentlyInCreation(beanName)) {
      throw new BeanCurrentlyInCreationException(beanName);
    }
    // 如果对spring没有进行改造，这里默认 parentBeanFactory为空
    BeanFactory parentBeanFactory = getParentBeanFactory();
    if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
      String nameToLookup = originalBeanName(name);
      if (parentBeanFactory instanceof AbstractBeanFactory) {
        return ((AbstractBeanFactory) parentBeanFactory).doGetBean(
            nameToLookup, requiredType, args, typeCheckOnly);
      }
      else if (args != null) {
        return (T) parentBeanFactory.getBean(nameToLookup, args);
      }
      else {
        return parentBeanFactory.getBean(nameToLookup, requiredType);
      }
    }
    if (!typeCheckOnly) {
      //typeCheckOnly为false，添加到alreadyCreated Set集合当中，表示它已经创建过
      //防止重复创建
      markBeanAsCreated(beanName);
    }
    //重点部分，创建singleton的bean，或创建新的prototype的bean
    try {
      final RootBeanDefinition mbd = getMergedLocalBeanDefinition(beanName);
      checkMergedBeanDefinition(mbd, beanName, args);

      // 判断当前bean是否有依赖，这里指的是使用depends-on的情况，需要先实例化依赖bean
      String[] dependsOn = mbd.getDependsOn();
      if (dependsOn != null) {
        for (String dep : dependsOn) {
          if (isDependent(beanName, dep)) {
            throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                "Circular depends-on relationship between '" + beanName + "' and '" + dep + "'");
          }
          //注册依赖关系
          registerDependentBean(dep, beanName);
          try {
            //初始化被依赖bean
            getBean(dep);
          }
          catch (NoSuchBeanDefinitionException ex) {
            throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                "'" + beanName + "' depends on missing bean '" + dep + "'", ex);
          }
        }
      } 
      //在这才真正创建bean的实例
      if (mbd.isSingleton()) {
        sharedInstance = getSingleton(beanName, () -> {
          try {
            //真正创建功能的语句
            return createBean(beanName, mbd, args);
          }
          catch (BeansException ex) {            
            destroySingleton(beanName);
            throw ex;
          }
        });
        bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
      }
      // 创建 prototype 的实例
      else if (mbd.isPrototype()) {        
        Object prototypeInstance = null;
        try {
          beforePrototypeCreation(beanName);
          prototypeInstance = createBean(beanName, mbd, args);
        }
        finally {
          afterPrototypeCreation(beanName);
        }
        bean = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
      }
      //如果不是singleto和prototype,委托给相应的实现类来处理
      else {
        String scopeName = mbd.getScope();
        final Scope scope = this.scopes.get(scopeName);
        if (scope == null) {
          throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
        }
        try {
          Object scopedInstance = scope.get(beanName, () -> {
            beforePrototypeCreation(beanName);
            try {
              return createBean(beanName, mbd, args);
            }
            finally {
              afterPrototypeCreation(beanName);
            }
          });
          bean = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
        }
      //抛出异常，代码省略...
  }
  //类型检查，正常则返回，异常则抛出
  if (requiredType != null && !requiredType.isInstance(bean)) {
    try {
      T convertedBean = getTypeConverter().convertIfNecessary(bean, requiredType);
      if (convertedBean == null) {
        throw new BeanNotOfRequiredTypeException(name, requiredType, bean.getClass());
      }
      return convertedBean;
    }
    catch (TypeMismatchException ex) {
      if (logger.isDebugEnabled()) {
        logger.debug("Failed to convert bean '" + name + "' to required type '" +
            ClassUtils.getQualifiedName(requiredType) + "'", ex);
      }
      throw new BeanNotOfRequiredTypeException(name, requiredType, bean.getClass());
    }
  }
  return (T) bean;
}
```

在创建bean前，首先调用了`DefaultSingletonBeanRegistry`的`getSingleton`方法，也就是说spring在初始化一个bean前先去尝试获取一次，判断这个对象是否已经被实例化好了，如果已经存在就直接拿过来用。进入`getSingleton`方法，核心代码：

```
Object singletonObject = this.singletonObjects.get(beanName);
```

看一下`singletonObjects`的定义：

```
private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);
```

这里提前剧透一下，这个Map就是用于存放实例化好的单例bean，并且从狭义上来说，可以说这个`singletonObjects`就是spring容器，并且它使用了`ConcurrentHashMap`，来保证并发操作的安全性。

因为我们的bean还处于创建阶段，那么这一次是肯定不能从Map获取到实例的，那么接着向下运行，看一下调用的`createBean`方法。

### 2、AbstractAutowireCapableBeanFactory 的 createBean方法：

```java
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args)
    throws BeanCreationException {
  if (logger.isDebugEnabled()) {
    logger.debug("Creating instance of bean '" + beanName + "'");
  }
  RootBeanDefinition mbdToUse = mbd;
  //确保 BeanDefinition 中的 Class 被加载
  Class<?> resolvedClass = resolveBeanClass(mbd, beanName);
  if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
    mbdToUse = new RootBeanDefinition(mbd);
    mbdToUse.setBeanClass(resolvedClass);
  }
  // 处理 lookup-method 和 replace-method 配置
  // spring中把lookup-method 和 replace-method 统称为method overrides
  try {
    mbdToUse.prepareMethodOverrides();
  }
  catch (BeanDefinitionValidationException ex) {
    throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(),
        beanName, "Validation of method overrides failed", ex);
  }
  try {
    //应用后置处理器，如果后置处理器返回的bean不为空则直接返回
    Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
    if (bean != null) {
      return bean;
    }
  }
  catch (Throwable ex) {
    throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName,
        "BeanPostProcessor before instantiation of bean failed", ex);
  }
  try {//调用doCreateBean创建bean
    Object beanInstance = doCreateBean(beanName, mbdToUse, args);
    if (logger.isDebugEnabled()) {
      logger.debug("Finished creating instance of bean '" + beanName + "'");
    }
    return beanInstance;
  }
  //非重要代码省略...
}
```

前面做了很长的铺垫工作，但还是没有创建bean，创建bean的工作被交给了`doCreateBean`方法完成。

### 3、AbstractAutowireCapableBeanFactory 的 doCreateBean方法：

```java
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final @Nullable Object[] args)
    throws BeanCreationException {
  //BeanWrapper是一个包装接口，真正实例化的是 BeanWrapperImpl
  BeanWrapper instanceWrapper = null;
  if (mbd.isSingleton()) {
    instanceWrapper = this.factoryBeanInstanceCache.remove(beanName);
  }
  if (instanceWrapper == null) {
    //创建bean实例，并将实例包裹在 BeanWrapper 实现类对象中返回
    instanceWrapper = createBeanInstance(beanName, mbd, args);
  }
  // 使用BeanWrapper 产生一个原生对象
  final Object bean = instanceWrapper.getWrappedInstance();
  Class<?> beanType = instanceWrapper.getWrappedClass();
  if (beanType != NullBean.class) {
    mbd.resolvedTargetType = beanType;
  }
  // Allow post-processors to modify the merged bean definition.
  synchronized (mbd.postProcessingLock) {
    if (!mbd.postProcessed) {
      try {
        //执行后置处理器MergedBeanDefinitionPostProcessor
        applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
      }
      catch (Throwable ex) {
        throw new BeanCreationException(mbd.getResourceDescription(), beanName,
            "Post-processing of merged bean definition failed", ex);
      }
      mbd.postProcessed = true;
    }
  }
  //用于处理循环依赖，后面单独分析
  boolean earlySingletonExposure = (mbd.isSingleton() && this.allowCircularReferences &&
      isSingletonCurrentlyInCreation(beanName));
  if (earlySingletonExposure) {
    if (logger.isDebugEnabled()) {
      logger.debug("Eagerly caching bean '" + beanName +
          "' to allow for resolving potential circular references");
    }
    //执行后置处理器    
    addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
  }
  //到此为止，还是原生对象
  Object exposedObject = bean;
  try {
    //赋值属性,依赖，非常重要
    populateBean(beanName, mbd, instanceWrapper);
    //执行后置处理器,变成代理对象，aop就是在这里完成的处理  
    exposedObject = initializeBean(beanName, exposedObject, mbd);
  }
  //中间非重要代码省略...
  return exposedObject;
}
```

这里面做了三个比较重要的工作：

①、调用`createBeanInstance`方法创建bean实例

②、调用`populateBean`进行属性的填充，依赖注入就是在这里完成

③、调用`initializeBean`，执行各种后置处理器，执行各种回调函数

我们按照顺序，先接着讲①中创建bean势力的过程，等这个过程完了再回头分析属性填充和回调方法。

### 4、AbstractAutowireCapableBeanFactory 的 createBeanInstance方法：

```java
protected BeanWrapper createBeanInstance(String beanName, RootBeanDefinition mbd, @Nullable Object[] args) {
  //确保加载了该class
  Class<?> beanClass = resolveBeanClass(mbd, beanName);

  //检测一个类的访问权限 spring默认情况下对于public的类是允许访问的
  if (beanClass != null && !Modifier.isPublic(beanClass.getModifiers()) && !mbd.isNonPublicAccessAllowed()) {
    throw new BeanCreationException(mbd.getResourceDescription(), beanName,
        "Bean class isn't public, and non-public access not allowed: " + beanClass.getName());
  }

  Supplier<?> instanceSupplier = mbd.getInstanceSupplier();
  if (instanceSupplier != null) {
    return obtainFromSupplier(instanceSupplier, beanName);
  }

  /*
  *如果工厂方法不为空，则通过工厂方法构建bean对象
  * factoryMethod基于xml，实际工作中很少使用
  *  */
  if (mbd.getFactoryMethodName() != null) {
    return instantiateUsingFactoryMethod(beanName, mbd, args);
  }

  /*
  * 从spring的原始注释可以知道这个是一个ShortCut，当多次构建同一个bean时，可以使用这个ShortCut
  * 这里的resolved和 mbd.constructorArgumentsResolved 将会在bean第一次实例化的过程中被设置
  * */
  boolean resolved = false;
  boolean autowireNecessary = false;
  if (args == null) {
    synchronized (mbd.constructorArgumentLock) {
      if (mbd.resolvedConstructorOrFactoryMethod != null) {
        resolved = true;
        //如果已经解析了构造方法的参数，则必须要通过一个带参数构造方法来实例
        autowireNecessary = mbd.constructorArgumentsResolved;
      }
    }
  }
  if (resolved) {
    if (autowireNecessary) {
      //通过构造方法自动装配的方式构造bean对象
      return autowireConstructor(beanName, mbd, null, null);
    }
    else {
      //通过默认的无参构造方法进行
      return instantiateBean(beanName, mbd);
    }
  }

  //spring目前不知道用什么方式实例化这个bean，所以先拿到所有的构造方法
  //由后置处理器决定返回哪些构造方法
  Constructor<?>[] ctors = determineConstructorsFromBeanPostProcessors(beanClass, beanName);
  /*
  * AUTOWIRE :  0-NO  ,1-BY_NAME,2-BY_TYPE,3-CONSTRUCTOR
  * 在这里mbd.getResolvedAutowireMode()取到的是0，就是NO
  * */
  if (ctors != null || mbd.getResolvedAutowireMode() == AUTOWIRE_CONSTRUCTOR ||
      mbd.hasConstructorArgumentValues() || !ObjectUtils.isEmpty(args)) {
    return autowireConstructor(beanName, mbd, ctors, args);
  }
  //使用默认的无参构造方法进行初始化
  return instantiateBean(beanName, mbd);
}
```

如果bean拥有多个构造方法的话，会根据参数去判断具体使用哪一个，具体内容比较复杂，准备以后放在一篇单独的文章中进行分析。如果只有无参构造方法或不写构造方法的话，都会默认使用无参构造方法进行实例化，这里暂时只对这种情况进行分析。

### 5、AbstractAutowireCapableBeanFactory 的 instantiateBean方法：

```java
protected BeanWrapper instantiateBean(final String beanName, final RootBeanDefinition mbd) {
  try {
    Object beanInstance;
    final BeanFactory parent = this;
    if (System.getSecurityManager() != null) {
      beanInstance = AccessController.doPrivileged((PrivilegedAction<Object>) () ->
          getInstantiationStrategy().instantiate(mbd, beanName, parent),
          getAccessControlContext());
    }
    else {
      // getInstantiationStrategy得到类的实例化策略
      beanInstance = getInstantiationStrategy().instantiate(mbd, beanName, parent);
    }
    BeanWrapper bw = new BeanWrapperImpl(beanInstance);
    initBeanWrapper(bw);
    return bw;
  }
  catch (Throwable ex) {
    throw new BeanCreationException(
        mbd.getResourceDescription(), beanName, "Instantiation of bean failed", ex);
  }
}
```

这里通过`getInstantiationStrategy`得到类的实例化策略，默认情况下是得到一个反射的实例化策略。然后调用`instantiate`方法进行实例化。

### 6、SimpleInstantiationStrategy 的 instantiate方法：

```java
public Object instantiate(RootBeanDefinition bd, @Nullable String beanName, BeanFactory owner) {
  // 检测bean配置中是否配置了lookup-method 或 replace-method
  //如果配置了就需使用CGLIB构建bean对象
  if (!bd.hasMethodOverrides()) {
    Constructor<?> constructorToUse;
    synchronized (bd.constructorArgumentLock) {
      constructorToUse = (Constructor<?>) bd.resolvedConstructorOrFactoryMethod;
      if (constructorToUse == null) {
        final Class<?> clazz = bd.getBeanClass();
        if (clazz.isInterface()) {
          throw new BeanInstantiationException(clazz, "Specified class is an interface");
        }
        try {
          if (System.getSecurityManager() != null) {
            constructorToUse = AccessController.doPrivileged(
                (PrivilegedExceptionAction<Constructor<?>>) clazz::getDeclaredConstructor);
          }
          else {
            //得到默认构造方法，即使没有写也会有一个
            constructorToUse = clazz.getDeclaredConstructor();
          }
          bd.resolvedConstructorOrFactoryMethod = constructorToUse;
        }
        catch (Throwable ex) {
          throw new BeanInstantiationException(clazz, "No default constructor found", ex);
        }
      }
    }               
    //使用构造方法进行实例化
    return BeanUtils.instantiateClass(constructorToUse);
  }
  else {
    //使用CGLIB进行实例化
    return instantiateWithMethodInjection(bd, beanName, owner);
  }
}
```

`instantiateClass`方法中，通过反射创建对象：

 ```java
//设置构造方法为可访问
ReflectionUtils.makeAccessible(ctor);
//反射创建对象
return (KotlinDetector.isKotlinType(ctor.getDeclaringClass()) ?
    KotlinDelegate.instantiateClass(ctor, args) : ctor.newInstance(args));
 ```

运行到这，实例化的过程就完成了，但是目前属性还没有注入，回到开头我们举的那个例子，其中还有一个Dao没有被注入，接下来分析属性的注入。

## 属性填充

实例化完成后，回到上面第3条的`doCreateBean`方法中，看一下用`BeanWrapper`产生的原生对象，里面`dao`这个属性还是`null`值。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dbc3d0357c9b49ebaba557c85363d2f9~tplv-k3u1fbpfcp-zoom-1.image)

回归一下之前的代码，接下来要调用`populateBean`方法进行属性的填充：

```java
Object exposedObject = bean;
try {
  populateBean(beanName, mbd, instanceWrapper);
  exposedObject = initializeBean(beanName, exposedObject, mbd);
}
```

看一下`populateBean`中的核心代码：

```java
for (BeanPostProcessor bp : getBeanPostProcessors()) {
  if (bp instanceof InstantiationAwareBeanPostProcessor) {
    InstantiationAwareBeanPostProcessor ibp = (InstantiationAwareBeanPostProcessor) bp;
    pvs = ibp.postProcessPropertyValues(pvs, filteredPds, bw.getWrappedInstance(), beanName);
    if (pvs == null) {
      return;
    }
  }
}
```

这里通过`getBeanPostProcessors`方法获得当前注册的所有后置处理器，如果属于`InstantiationAwareBeanPostProcessor`类型，则调用它的`postProcessPropertyValues`方法。通过遍历，可以知道当前spring中存在7个后置处理器：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/65501cb4f43d4134ab6dfedfbda749e3~tplv-k3u1fbpfcp-zoom-1.image)

我们主要来看一下`AutowiredAnnotationBeanPostProcessor`，因为它负责对添加了 `@Autowired`、`@Value`等注解的属性进行依赖的填充。进入它的`postProcessPropertyValues`方法：

```java
public PropertyValues postProcessPropertyValues(
  PropertyValues pvs, PropertyDescriptor[] pds, Object bean, String beanName) throws BeanCreationException {
  InjectionMetadata metadata = findAutowiringMetadata(beanName, bean.getClass(), pvs);
  try {
    metadata.inject(bean, beanName, pvs);
  }
 //异常处理代码省略...
  return pvs;
}
```

这里的`InjectionMetadata`可以理解为要注入的属性的元数据，在它里面维护了一个`Collection`，来存放所有需要注入的bean：

```java
private final Collection<InjectedElement> injectedElements;
```

进入`findAutowiringMetadata`方法：

 ```java
private InjectionMetadata findAutowiringMetadata(String beanName, Class<?> clazz, @Nullable PropertyValues pvs) {  
  String cacheKey = (StringUtils.hasLength(beanName) ? beanName : clazz.getName());
  InjectionMetadata metadata = this.injectionMetadataCache.get(cacheKey);
   //省略非重要代码...
  return metadata;
}
 ```

在执行完这一步后，就把需要填充的属性放进了刚才提到的`injectedElements`中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c10f0543d6fa4f54a2940bce13bc9bc8~tplv-k3u1fbpfcp-zoom-1.image)

接下来，继续执行`InjectionMetadata`的`inject`方法，在其中遍历所有需要注入的属性的列表，遍历调用`AutowiredAnnotationBeanPostProcessor的inject`方法：

```java
protected void inject(Object bean, @Nullable String beanName, @Nullable PropertyValues pvs) throws Throwable {
      Field field = (Field) this.member;
      Object value;
      if (this.cached) {
        value = resolvedCachedArgument(beanName, this.cachedFieldValue);
      }
      else {
        DependencyDescriptor desc = new DependencyDescriptor(field, this.required);
        desc.setContainingClass(bean.getClass());
        Set<String> autowiredBeanNames = new LinkedHashSet<>(1);
        Assert.state(beanFactory != null, "No BeanFactory available");
        TypeConverter typeConverter = beanFactory.getTypeConverter();
        try {//用beanFactory解决依赖
          value = beanFactory.resolveDependency(desc, beanName, autowiredBeanNames, typeConverter);
        }
   //后面代码省略...
```

这里创建了一个`DependencyDescriptor`，用来维护注入属性与它的**容器类**`containingClass`的关系，里面最重要的就是存放了注入属性的类型、名称，以及`containingClass`的类型等信息。

调用`resolveDependency`方法，其中没有做什么实质性的工作，继续调用了`doResolveDependency`方法：

```java
public Object doResolveDependency(DependencyDescriptor descriptor, @Nullable String beanName,
    @Nullable Set<String> autowiredBeanNames, @Nullable TypeConverter typeConverter) throws BeansException {
  InjectionPoint previousInjectionPoint = ConstructorResolver.setCurrentInjectionPoint(descriptor);
  try {
    Object shortcut = descriptor.resolveShortcut(this);
    if (shortcut != null) {
      return shortcut;
    }
    //依赖的属性值的类型
    Class<?> type = descriptor.getDependencyType();
    Object value = getAutowireCandidateResolver().getSuggestedValue(descriptor);
    if (value != null) {
      if (value instanceof String) {
        String strVal = resolveEmbeddedValue((String) value);
        BeanDefinition bd = (beanName != null && containsBean(beanName) ? getMergedBeanDefinition(beanName) : null);
        value = evaluateBeanDefinitionString(strVal, bd);
      }
      TypeConverter converter = (typeConverter != null ? typeConverter : getTypeConverter());
      return (descriptor.getField() != null ?
          converter.convertIfNecessary(value, type, descriptor.getField()) :
          converter.convertIfNecessary(value, type, descriptor.getMethodParameter()));
    }

    Object multipleBeans = resolveMultipleBeans(descriptor, beanName, autowiredBeanNames, typeConverter);
    if (multipleBeans != null) {
      return multipleBeans;
    }
    //把匹配的值和类型拿出来，放到一个map中
    Map<String, Object> matchingBeans = findAutowireCandidates(beanName, type, descriptor);
    if (matchingBeans.isEmpty()) {
      if (isRequired(descriptor)) {
        raiseNoMatchingBeanFound(type, descriptor.getResolvableType(), descriptor);
      }
      return null;
    }

    String autowiredBeanName;
    Object instanceCandidate;
    //如果有超过一个匹配的，可能会有错误
    if (matchingBeans.size() > 1) {
      autowiredBeanName = determineAutowireCandidate(matchingBeans, descriptor);
      if (autowiredBeanName == null) {
        if (isRequired(descriptor) || !indicatesMultipleBeans(type)) {
          return descriptor.resolveNotUnique(type, matchingBeans);
        }
        else {        
          return null;
        }
      }
      instanceCandidate = matchingBeans.get(autowiredBeanName);
    }
    else {      
      Map.Entry<String, Object> entry = matchingBeans.entrySet().iterator().next();
      autowiredBeanName = entry.getKey();
      instanceCandidate = entry.getValue();
    }

    if (autowiredBeanNames != null) {
      //把找到的bean的名字放到set中
      autowiredBeanNames.add(autowiredBeanName);
    }
    if (instanceCandidate instanceof Class) {
      // 实际获取注入的bean
      instanceCandidate = descriptor.resolveCandidate(autowiredBeanName, type, this);
    }
    Object result = instanceCandidate;
    if (result instanceof NullBean) {
      if (isRequired(descriptor)) {
        raiseNoMatchingBeanFound(type, descriptor.getResolvableType(), descriptor);
      }
      result = null;
    }
    if (!ClassUtils.isAssignableValue(type, result)) {
      throw new BeanNotOfRequiredTypeException(autowiredBeanName, type, instanceCandidate.getClass());
    }
    return result;
  }
  finally {
    ConstructorResolver.setCurrentInjectionPoint(previousInjectionPoint);
  }
}
```

通过`findAutowireCandidates`方法，获取与注入属性匹配的值和类型，放到一个Map当中，再通过它的`beanName`，调用`resolveCandidate`方法，实际获取注入的bean实例。这一操作底层调用的也是`BeanFactory的getBean`方法。

回到`inject`方法，使用反射将注入的bean实例赋值给属性：

```java
ReflectionUtils.makeAccessible(field);
field.set(bean, value);
```

在执行完`populateBean`方法后，依赖的属性已经被注入成功了。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bf36c4e599334a3a98758876ebbf6188~tplv-k3u1fbpfcp-zoom-1.image)

## 执行回调方法及后置处理器

在bean实例化完成后，执行各种回调和后置管理器方法：

```java
protected Object initializeBean(final String beanName, final Object bean, @Nullable RootBeanDefinition mbd) {
  if (System.getSecurityManager() != null) {
    AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
      invokeAwareMethods(beanName, bean);
      return null;
    }, getAccessControlContext());
  }
  else {
    //若bean实现了BeanNameAware、BeanClassLoaderAware、BeanFactoryAware接口，执行回调方法
    invokeAwareMethods(beanName, bean);
  }

  Object wrappedBean = bean;
  if (mbd == null || !mbd.isSynthetic()) {       
    //执行所有后置处理器的before方法
    wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
  }

  try {
    //执行bean生命周期回调中的init-method
    //若bean实现了InitializingBean接口，执行afterPropertiesSet方法
    invokeInitMethods(beanName, wrappedBean, mbd);
  }
  catch (Throwable ex) {
    throw new BeanCreationException(
        (mbd != null ? mbd.getResourceDescription() : null),
        beanName, "Invocation of init method failed", ex);
  }
  if (mbd == null || !mbd.isSynthetic()) {
    //执行所有后置处理器的after方法
    wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
  }

  return wrappedBean;
}
```

具体执行内容：

1、若bean实现了`BeanNameAware`、`BeanClassLoaderAware`、`BeanFactoryAware`接口，执行回调方法

2、执行所有后置处理器的`postProcessBeforeInitialization`方法

3、执行bean生命周期回调中的`init-method`，若bean实现了`InitializingBean`接口，执行`afterPropertiesSet`方法

4、执行所有后置处理器的`postProcessAfterInitialization`方法

在这一步完成后，bean的实例化过程全部结束。最后执行一下`refresh`方法中的`finishRefresh`方法，进行广播事件等操作。到这，一个完整的`AnnotationConfigApplicationContext`初始化就完成了。