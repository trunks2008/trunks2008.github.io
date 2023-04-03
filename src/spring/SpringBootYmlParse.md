---
title: 18张图，详解SpringBoot解析yml全流程
icon: page
order: 7
author: Hydra
date: 2022-07-05
tag:
  - SpringBoot
  - yml
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

前几天的时候，项目里有一个需求，需要一个开关控制代码中是否执行一段逻辑，于是理所当然的在`yml`文件中配置了一个属性作为开关，再配合`nacos`就可以随时改变这个值达到我们的目的，yml文件中是这样写的：

```yml
switch:
  turnOn: on
```

程序中的代码也很简单，大致的逻辑就是下面这样，如果取到的开关字段是`on`的话，那么就执行`if`判断中的代码，否则就不执行：

```java
@Value("${switch.turnOn}")
private String on;

@GetMapping("testn")
public void test(){
    if ("on".equals(on)){
        //TODO
    }
}
```

但是当代码实际跑起来，有意思的地方来了，我们发现判断中的代码一直不会被执行，直到debug一下，才发现这里的取到的值居然不是`on`而是`true`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9651d6c00ce4414f96e5c186027125a2~tplv-k3u1fbpfcp-zoom-1.image)

看到这，是不是感觉有点意思，首先盲猜是在解析yml的过程中把`on`作为一个特殊的值进行了处理，于是我干脆再多测试了几个例子，把yml中的属性扩展到下面这些：

```yml
switch:
  turnOn: on
  turnOff: off
  turnOn2: 'on'
  turnOff2: 'off'
```

再执行一下代码，看一下映射后的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/62aa41f4f0d4457ea299f032c7f4976e~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，yml中没有带引号的`on`和`off`被转换成了`true`和`false`，带引号的则保持了原来的值不发生改变。

到这里，让我忍不住有点好奇，为什么会发生这种现象呢？于是强忍着困意翻了翻源码，硬磕了一下SpringBoot加载yml配置文件的过程，终于让我看出了点门道，下面我们一点一点细说！

因为配置文件的加载会涉及到一些SpringBoot启动的相关知识，所以如果对SpringBoot启动不是很熟悉的同学，可以先提前先看一下Hydra在古早时期写过一篇**Spring Boot零配置启动原理**预热一下。下面的介绍中，只会摘出一些对加载和解析配置文件比较重要的步骤进行分析，对其他无关部分进行了省略。

## 加载监听器

当我们启动一个SpringBoot程序，在执行`SpringApplication.run()`的时候，首先在初始化`SpringApplication`的过程中，加载了11个实现了`ApplicationListener`接口的拦截器。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/40b8ca76fa7844f09bad9ad3fbb31d40~tplv-k3u1fbpfcp-zoom-1.image)

这11个自动加载的`ApplicationListener`，是在`spring.factories`中定义并通过`SPI`扩展被加载的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fab97496769f4f73938a9173ae5bff0e~tplv-k3u1fbpfcp-zoom-1.image)

这里列出的10个是在`spring-boot`中加载的，还有剩余的1个是在`spring-boot-autoconfigure`中加载的。其中最关键的就是`ConfigFileApplicationListener`，它和后面要讲到的配置文件的加载相关。

## 执行run方法

在实例化完成`SpringApplication`后，会接着往下执行它的`run`方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/05c95482d3344cb5acaf14b7aea3da0a~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，这里通过`getRunListeners`方法获取的`SpringApplicationRunListeners`中，`EventPublishingRunListener`绑定了我们前面加载的11个监听器。但是在执行`starting`方法时，根据类型进行了过滤，最终实际只执行了**4个**监听器的`onApplicationEvent`方法，并没有我们希望看到的`ConfigFileApplicationListener`，让我们接着往下看。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/842e517b49c348788007c6153b74cf89~tplv-k3u1fbpfcp-zoom-1.image)

当`run`方法执行到`prepareEnvironment`时，会创建一个`ApplicationEnvironmentPreparedEvent`类型的事件，并广播出去。这时所有的监听器中，有7个会监听到这个事件，之后会分别调用它们的`onApplicationEvent`方法，其中就有了我们心心念念的`ConfigFileApplicationListener`，接下来让我们看看它的`onApplicationEvent`方法中做了什么。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0f61b6029ddd47e5a454e8ecaa154979~tplv-k3u1fbpfcp-zoom-1.image)

在方法的调用过程中，会加载系统自己的4个后置处理器以及`ConfigFileApplicationListener`自身，一共5个后置处理器，并执行他们的`postProcessEnvironment`方法，其他4个对我们不重要可以略过，最终比较关键的步骤是创建`Loader`实例并调用它的`load`方法。

## 加载配置文件

这里的`Loader`是`ConfigFileApplicationListener`的一个内部类，看一下`Loader`对象实例化的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7c30936c75a14d0987ebbbdda4ea1318~tplv-k3u1fbpfcp-zoom-1.image)

在实例化`Loader`对象的过程中，再次通过SPI扩展的方式加载了两个属性文件加载器，其中的`YamlPropertySourceLoader`就和后面的yml文件的加载、解析密切关联，而另一个`PropertiesPropertySourceLoader`则负责`properties`文件的加载。创建完`Loader`实例后，接下来会调用它的`load`方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1607e4dc5bb74e25a4747ab4916dfccc~tplv-k3u1fbpfcp-zoom-1.image)

在`load`方法中，会通过嵌套循环方式遍历默认配置文件存放路径，再加上默认的配置文件名称、以及不同配置文件加载器对应解析的后缀名，最终找到我们的yml配置文件。接下来，开始执行`loadForFileExtension`方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6a9635e5076f4846b87873cc0985fab1~tplv-k3u1fbpfcp-zoom-1.image)

在`loadForFileExtension`方法中，首先将`classpath:/application.yml`加载为`Resource`文件，接下来准备正式开始，调用了之前创建好的`YamlPropertySourceLoader`对象的`load`方法。

## 封装Node

在`load`方法中，开始准备进行配置文件的解析与数据封装：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e47bec73004f49c19ac4676ac7d0c705~tplv-k3u1fbpfcp-zoom-1.image)

`load`方法中调用了`OriginTrackedYmlLoader`对象的`load`方法，从字面意思上我们也可以理解，它的用途是原始追踪yml的加载器。中间一连串的方法调用可以忽略，直接看最后也是最重要的是一步，调用`OriginTrackingConstructor`对象的`getData`接口，来解析yml并封装成对象。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0726fdf6a49b4e2fa9cf1ea0afee4d1b~tplv-k3u1fbpfcp-zoom-1.image)

在解析yml的过程中实际使用了`Composer`构建器来生成节点，在它的`getNode`方法中，通过解析器事件来创建节点。通常来说，它会将yml中的一组数据封装成一个`MappingNode`节点，它的内部实际上是一个`NodeTuple`组成的`List`，`NodeTuple`和`Map`的结构类似，由一对对应的`keyNode`和`valueNode`构成，结构如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/51c6e43ecf1744b5bea6daba9a70e634~tplv-k3u1fbpfcp-zoom-1.image)

好了，让我们再回到上面的那张方法调用流程图，它是根据文章开头的yml文件中实际内容内容绘制的，如果内容不同调用流程会发生改变，大家只需要明白这个原理，下面我们具体分析。

首先，创建一个`MappingNode`节点，并将`switch`封装成`keyNode`，然后再创建一个`MappingNode`，作为外层`MappingNode`的`valueNode`，同时存储它下面的4组属性，这也是为什么上面会出现4次循环的原因。如果有点困惑也没关系，看一下下面的这张图，就能一目了然了解它的结构。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f74cbeaaf5a5403180d3a088514dd13d~tplv-k3u1fbpfcp-zoom-1.image)

在上图中，又引入了一种新的`ScalarNode`节点，它的用途也比较简单，简单String类型的字符串用它来封装成节点就可以了。到这里，yml中的数据被解析完成并完成了初步的封装，可能眼尖的小伙伴要问了，上面这张图中为什么在`ScalarNode`中，除了`value`还有一个`tag`属性，这个属性是干什么的呢？

在介绍它的作用前，先说一下它是怎么被确定的。这一块的逻辑比较复杂，大家可以翻一下`ScannerImpl`类`fetchMoreTokens`方法的源码，这个方法会根据yml中每一个`key`或`value`是以什么开头，来决定以什么方式进行解析，其中就包括了`{`、`[`、`'`、`%`、`?`等特殊符号的情况。以解析不带任何特殊字符的字符串为例，简要的流程如下，省略了一些不重要部分：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/939aeea7aab741f89a0f5f4acd690051~tplv-k3u1fbpfcp-zoom-1.image)

在这张图的中间步骤中，创建了两个比较重要的对象`ScalarToken`和`ScalarEvent`，其中都有一个为`true`的`plain`属性，可以理解为这个属性是否需要**解释**，是后面获取`Resolver`的关键属性之一。

上图中的`yamlImplicitResolvers`其实是一个提前缓存好的HashMap，已经提前存储好了一些`Char`类型字符与`ResolverTuple`的对应关系：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/71f09ebdb22e40c9ab29a0445dbf2361~tplv-k3u1fbpfcp-zoom-1.image)

当解析到属性`on`时，取出首字母`o`对应的`ResolverTuple`，其中的`tag`就是`tag:yaml.org.2002:bool`。当然了，这里也不是简单的取出就完事了，后续还会对属性进行正则表达式的匹配，看与`regexp`中的值是否能对的上，检查无误时才会返回这个`tag`。

到这里，我们就解释清楚了`ScalarNode`中`tag`属性究竟是怎么获取到的了，之后方法调用层层返回，返回到`OriginTrackingConstructor`父类`BaseConstructor`的`getData`方法中。接下来，继续执行`constructDocument`方法，完成对yml文档的解析。

## 调用构造器

在`constructDocument`中，有两步比较重要，第一步是推断当前节点应该使用哪种类型的构造器，第二步是使用获得的构造器来重新对`Node`节点中的`value`进行赋值，简易流程如下，省去了循环遍历的部分：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d58e35bba6d540fe885c459a15b3ad57~tplv-k3u1fbpfcp-zoom-1.image)

推断构造器种类的过程也很简单，在父类`BaseConstructor`中，缓存了一个HashMap，存放了节点的`tag`类型到对应构造器的映射关系。在`getConstructor`方法中，就使用之前节点中存入的`tag`属性来获得具体要使用的构造器：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7e0202a35c2040c099ba55d729b57878~tplv-k3u1fbpfcp-zoom-1.image)

当`tag`为`bool`类型时，会找到`SafeConstruct`中的内部类 `ConstructYamlBool`作为构造器，并调用它的`construct`方法实例化一个对象，来作为`ScalarNode`节点的`value`的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1335cdc46b27491fa88adeabc53bcce1~tplv-k3u1fbpfcp-zoom-1.image)

在`construct`方法中，取到的val就是之前的`on`，至于下面的这个`BOOL_VALUES`，也是提前初始化好的一个HashMap，里面提前存放了一些对应的映射关系，key是下面列出的这些关键字，value则是`Boolean`类型的`true`或`false`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6b071e0230644b3fb6892ddb11b5159a~tplv-k3u1fbpfcp-zoom-1.image)

到这里，yml中的属性解析流程就基本完成了，我们也明白了为什么yml中的`on`会被转化为`true`的原理了。至于最后，`Boolean`类型的`true`或`false`是如何被转化为的字符串，就是`@Value`注解去实现的了。

## 思考

那么，下一个问题来了，既然yml文件解析中会做这样的特殊处理，那么如果换成`properties`配置文件怎么样呢？

```properties
sw.turnOn=on
sw.turnOff=off
```

执行一下程序，看一下结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/74e6e58ae1694cee9c79ce0860a11fbf~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，使用`properties`配置文件能够正常读取结果，看来是在解析的过程中没有做特殊处理，至于解析的过程，有兴趣的小伙伴可以自己去阅读一下源码。

那么，今天就写到这里，我们下期见。