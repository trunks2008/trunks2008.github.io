---
title: Eureka核心源码解析
icon: page
order: 1
author: Hydra
date: 2020-05-22
tag:
  - Spring Cloud
  - Eureka
star: true
---



<!-- more -->

Eureka作为Spring Cloud的核心模块之一，担任着服务注册发现等重要作用。如果梳理一下Eureka实际的工作流程，大体可以将它分为以下几个部分：

- 服务注册
- 服务续约
- 服务剔除
- 服务下线
- 服务发现
- 集群信息同步

上述各个方面，基于服务的运行场景不同，可能分别从Eureka的服务端（注册中心）与客户端（包含服务提供者与服务调用者）进行分析，为了简便下文中将Eureka服务端称为Eureka-server，客户端称为Eureka-client。本文先来说说基础的服务注册。

## 服务注册

### Eureka-client

在Eureka-client中，DiscoveryClient这个类用来和Eureka-server互相协作，看一下它的注释，它可以完成服务注册，服务续约，服务下线，获取服务列表等工作，可以说它完成了client的大多数功能。首先，看一下用来向eureka-server发起注册请求的`register`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bef24ee0178847d3b9e756887c7e2c0c~tplv-k3u1fbpfcp-zoom-1.image)

调用 `AbstractJerseyEurekaHttpClient` 类的`register`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fb02bc7e8ae6483da59486cbd1b4120a~tplv-k3u1fbpfcp-zoom-1.image)

Jersey是一个Restful请求服务的框架，与常用的springmvc类似，后面会讲到在Eureka-server拦截请求的时候也用到了Jersy。

在这里调用底层类：

```java
com.sun.jersey.api.client.Client
```

通过HTTP客户端发送http请求，并构建响应结果。

### Eureka-server

在Eureka-server，配置好`yml`文件中必需的参数后，只需要一个注解开启：

```java
@EnableEurekaServer
```

查看该注解的实现方法，发现为空白注解，并使用了`@Import`：

```java
@Import(EurekaServerMarkerConfiguration.class)
```

查看`EurekaServerMarkerConfiguration`类的实现：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9219eac2b58f4e639b2ad3a68182c680~tplv-k3u1fbpfcp-zoom-1.image)

在这里只向spring容器中注入bean，没有任何意义。这里用到了Springboot的自动装配（这个不熟悉的可以参考[springboot零配置启动](https://juejin.cn/post/7019224268000985125)）：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/97da9b63cb3647ae9427ea5cf4b59afd~tplv-k3u1fbpfcp-zoom-1.image)

发现Eureka server核心的自动配置类`EurekaServerAutoConfiguration`

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1540e0e8644745b7bbfd470a0306b1f6~tplv-k3u1fbpfcp-zoom-1.image)

我们看到，在这个类上有条件注入注解：

```java
@ConditionalOnBean(EurekaServerMarkerConfiguration.Marker.class)
```

只有在Spring容器中存在Marker这个Bean时才会实例化这个类，所以`@EnableEurekaServer`就相当于一个开关，起到标识的作用。

在这个配置类中定义了拦截器，同样使用Jersy拦截请求：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/56fde61e89864bf8a16324c9d8b9b589~tplv-k3u1fbpfcp-zoom-1.image)

`ApplicationResource`类的`addInstance`方法接收请求，在对实例的信息进行验证后，向服务注册中心添加实例：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/133f5feb2f604c0094288ddf2962ff6c~tplv-k3u1fbpfcp-zoom-1.image)

进入`InstanceRegistry`的`register`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7960d469b3124cdab23471221fe86f2b~tplv-k3u1fbpfcp-zoom-1.image)

在这里做了两个功能：

1、调用`handleRegistration`，在方法中使用`publishEvent`发布了监听事件 。Spring支持事件驱动，可以监听者模式进行事件的监听，这里广播给所有监听者，收到一个服务注册的请求。

至于监听器，可以由我们自己手写实现，参数中的事件类型spring会帮我们直接注入：

```java
@Component
public class EurekaRegisterListener {
  @EventListener
  public void registe(EurekaInstanceRegisteredEvent event){
    System.out.println(event.getInstanceInfo().getAppName());
  }
}
```

2、调用父类`PeerAwareInstanceRegistryImpl`的`register`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e8bfa88da400419ca69909d43a04a6ff~tplv-k3u1fbpfcp-zoom-1.image)

进行了下面的操作：

① 拿到微服务的过期时间，并进行更新

② 将服务注册交给父类完成

③ 完成集群信息同步（这个会在后面说明）

调用父类`AbstractInstanceRegistry`的`register`方法，在这开始真正开始做服务注册。先说一下在这个类中定义的Eureka-server的服务注册列表的结构：

```java
ConcurrentHashMap<String, Map<String, Lease<InstanceInfo>>> registry;
```

`ConcurrentHashMap`中外层的String表示服务名称；

`Map`中的String表示服务节点的id （也就是实例的instanceid）；

`Lease`是一个心跳续约的对象，`InstanceInfo`表示实例信息。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39ba660a4c06482a94c0a565326c286e~tplv-k3u1fbpfcp-zoom-1.image)

首先，注册表根据微服务的名称或取Map，如果不存在就新建，使用`putIfAbsent`。

然后，从`gMap`（gMap就是该服务的实例列表）获取一次服务实例，判断这个微服务的节点是否存在，第一次注册的情况下一般是不存在的

当然，也有可能会发生注册信息冲突时，这时Eureka会根据最后活跃时间来判断到底覆盖哪一个：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/549c0c8f804b47479b872dc6ab00466c~tplv-k3u1fbpfcp-zoom-1.image)

这段代码中，Eureka拿到存在节点的最后活跃时间，和当前注册节点的发起注册时间，进行对比。当存在的节点的最后活跃时间大于当前注册节点的时间，就说明之前存在的节点更活跃，就替换当前节点。

这里有一个思想，就是如果Eureka缓存的老节点更活跃，就说明它能够使用，而新来的服务我并不知道是否能用，那么Eureka就保守的使用了可用的老节点，从这一点也保证了可用性

在拿到服务实例后对其进行封装：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/16ec9d7500bc4d1ea46767b73fef4dc0~tplv-k3u1fbpfcp-zoom-1.image)

Lease是一个心跳续约的包装类，里面存放了注册信息，最后操作时间，注册时间，过期时间，剔除时间等信息。在这里把注册实例及过期时间放到这个心跳续约对象中，再把心跳续约对象放到`gmap`注册表中去。之后进行改变服务状态，系统数据统计，至此一个服务注册的流程就完成了。

注册完成后，查看一下`registry`中的服务实例，发现我们启动的Eureka-client都已经放在里面了：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ff19e924d4454721a0dcbc0a4509c29a~tplv-k3u1fbpfcp-zoom-1.image)

## 服务续约

### Eureka-client

服务续约由Eureka-client端主动发起，由之前介绍过的`DiscoveryClient`类中的`renew`方法完成，主要内容仍然是发送http请求：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ece9779e250e44c68f553ba22fa14e92~tplv-k3u1fbpfcp-zoom-1.image)

每隔30秒进行一次续约,调用`AbstractJerseyEurekaHttpClient`的`sendHeartBeat`方法:

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ac22625742fc4fcaa1ec9e001eb174e5~tplv-k3u1fbpfcp-zoom-1.image)

### Eureka-server

在Eureka-server端，服务续约的调用链与服务注册基本相同：

```java
InstanceRegistry # renew() ->
PeerAwareInstanceRegistry # renew()->
AbstractInstanceRegistry # renew()v
```

主要看一下`AbstractInstanceRegistry` 的`renew`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab5fa4301f894d1382e617cb1c8863a0~tplv-k3u1fbpfcp-zoom-1.image)

先从注册表获取该服务的实例列表gMap，再从gMap中通过实例的id 获取具体的 要续约的实例。之后根据服务实例的`InstanceStatus`判断是否处于宕机状态，以及是否和之前状态相同。如果一切状态正常，最终调用`Lease`中的`renew`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b94cad4e00fa4ba4ad696a865bb06fe2~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，其实服务续约的操作非常简单，它的本质就是修改服务的最后的更新时间。将最后更新时间改为系统当前时间加上服务的过期时间。值得提一下的是，`lastUpdateTimestamp`这个变量是被`volatile`关键字修饰的。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/758d4b3e74724a759f8df05013a3c382~tplv-k3u1fbpfcp-zoom-1.image)

之前的文章中我们讲过`volitaile`是用来保证可见性的。那么要被谁可见呢，提前说一下，这里要被服务剔除中执行的定时任务可见，后面会具体分析。

## 服务剔除

### Eureka-server

当Eureka-server发现有的实例没有续约超过一定时间，则将该服务从注册列表剔除，该项工作由一个定时任务完成的。该任务的定义过程比较复杂，仅列出其调用过程：

```java
EurekaServerInitializerConfiguration # start() ->
EurekaServerBootstrap # contextInitialized() ->
                      # initEurekaServerContext() ->
PeerAwareInstanceRegistryImpl # openForTraffic() ->
AbstractInstanceRegistry # postInit()
```

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1181721c1b634e0cb236fa3f0c093293~tplv-k3u1fbpfcp-zoom-1.image)

在`AbstractInstanceRegistry`的`postInit`方法中，定义`EvictionTask`定时任务，构建定时器启动该任务，执行任务中剔除方法 `evict()`。

```java
private long evictionIntervalTimerInMs = 60 * 1000;
```

任务的时间被定义为60秒，即默认每分钟执行一次。具体查看`evit()`剔除方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c2ef8efa38248e5a6de2732200b0ef9~tplv-k3u1fbpfcp-zoom-1.image)

实现了功能：

1、新建实例列表`expiredLeases`，用来存放过期的实

2、遍历`registry`注册表，对实例进行检测工作，使用`isExpired`方法判断实例是否过期：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8945595678654e05ba52a0e504e0195a~tplv-k3u1fbpfcp-zoom-1.image)

解释一下各个参数的意义：

```
evictionTimestamp：剔除时间，当剔除节点的时候，将系统当前时间赋值给这个evictionTimestamp
additionalLeaseMs：集群同步产生的预留时间，这个时间是程序中传过来的
```

这里进行判断：

```
系统当前时间 > 最后更新时间 + 过期时间 + 预留时间
```

当该条件成立时，认为服务过期。在Eureka中过期时间默认定义为3个心跳的时间，一个心跳是30秒，因此过期时间是90秒。当该条件成立时，认为服务过期。在Eureka中过期时间默认定义为3个心跳的时间，一个心跳是30秒，因此过期时间是90秒

当以上两个条件之一成立时，判断该实例过期，将该过期实例放入上面创建的列表中。注意这里仅仅是将实例放入List中，并没有实际剔除。

在实际剔除任务前，需要提一下eureka的自我保护机制，当15分钟内，心跳失败的服务大于一定比例时，会触发自我保护机制。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d540b97aaf346df90aeb60a3bf44379~tplv-k3u1fbpfcp-zoom-1.image)

这个值在Eureka中被定义为85%，一旦触发自我保护机制，Eureka会尝试保护其服务注册表中的信息，不再删除服务注册表中的数据。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bcea09d256f747fe8169b2a6ac6d0ee4~tplv-k3u1fbpfcp-zoom-1.image)

参数意义：

```
registrySizeThreshold：根据阈值计算可以被剔除的服务数量最大值
evictionLimit：剔除后剩余最小数量
expiredLeases.size()：剔除列表的数量
```

上面的代码中根据自我保护机制进行了判断，使用Min函数计算两者的最小值，剔除较小数量的服务实例。

举个例子，假如当前共有100个服务，那么剔除阈值为85，如果list中有60个服务，那么就会剔除该60个服务。但是如果list中有95个服务，那么只会剔除其中的85个服务，在这种情况下，又会产生一个问题，eureka-server该如何判断去剔除哪些服务，保留哪些服务呢？

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82c4bc17954042b4a02f23c6ee672c4e~tplv-k3u1fbpfcp-zoom-1.image)

这里使用了随机算法进行剔除，保证不会连续剔除某个微服务的全部实例。最终调用`internalCancel`方法，实际执行剔除。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b78ead27ee14babb1cd6fca36e6853c~tplv-k3u1fbpfcp-zoom-1.image)

其实剔除操作的实质非常简单，就是从`gMap`中`remove`掉这个节点，并从缓存中剔除。

## 服务下线

### Eureka-client

当eureka-client关闭时，不会立刻关闭，需要先发请求给eureka-server，告知自己要下线了。主要看一下客户端`shutdown`方法，其中调用关键的`unregister`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef554c934baa48b6b936e5bbeeb69545~tplv-k3u1fbpfcp-zoom-1.image)

调用`AbstractJerseyEurekaHttpClient` 的`cancel`方法

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df6638efe40047b9ae1dbfbd653d1455~tplv-k3u1fbpfcp-zoom-1.image)

发送http请求告诉eureka-server自己下线。

### Eureka-server

调用`AbstractInstanceRegistry`中 `cancel`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d7ed07f187784a8ea6bfdcbd58784964~tplv-k3u1fbpfcp-zoom-1.image)

最终还是调用了和服务剔除中一样的方法，`remove`掉了`gMap`中的实例。

## 服务发现

### Eureka-client

在学习服务发现的源码前，先写一个测试用例：

```java
@Autowired
private DiscoveryClient discoveryClient;

@GetMapping("/find")
public void test(String id){
    List<ServiceInstance> instances = discoveryClient.getInstances(id);
    System.out.println(instances);
}
```

调用`DiscoveryClient` 的`getInstances`方法，可以根据服务id获取服务实例列表：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/939f50bd7c01456ca938250645b1bd2b~tplv-k3u1fbpfcp-zoom-1.image)

那么这里就有一个问题了，我们还没有去调用微服务，那么服务列表是什么时候被拉取或缓存到本地的服务列表的呢？答案是在这里调用了`CompositeDiscoveryClient` 的 `getInstances()`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dd266ca62a4f481eb7eba6ba7abdde9f~tplv-k3u1fbpfcp-zoom-1.image)

中间调用过程省略：

```java
EurekaDiscoveryClient # getInstances() ->
DiscoveryClient # getInstancesByVipAddress() ->
                # getInstancesByVipAddress() ->  //和上面不是一个方法
Applications # getInstancesByVirtualHostName()
```

查看`Applications`中的`getInstancesByVirtualHostName`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/96fbc1b3945445f6978da558e3765f7c~tplv-k3u1fbpfcp-zoom-1.image)

发现一个名为`virtualHostNameAppMap`的Map集合中已经保存了当前所有注册到eureka的服务列表。

```java
private final Map<String, VipIndexSupport> virtualHostNameAppMap;
```

也就是说，在我们没有手动去调用服务的时候，该集合里面已经有值了，说明在Eureka-server项目启动后，会自动去拉取服务，并将拉取的服务缓存起来。

那么追根溯源，来查找一下服务的发现究竟是什么时候完成的。回到`DiscoveryClient`这个类，在它的构造方法中定义了任务调度线程池`cacheRefreshExecutor`，定义完成后，调用`initScheduledTask`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef4e409be85545ccbbab04e71708e681~tplv-k3u1fbpfcp-zoom-1.image)

在这个thread中，调用了`refreshRegistry()`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f2b414fc8444437aacec3eccb46bf87b~tplv-k3u1fbpfcp-zoom-1.image)

在`fetchRegistry`方法中，执行真正的服务列表拉取：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/645d8498664744b6a37a38e2eca2a7dc~tplv-k3u1fbpfcp-zoom-1.image)

在`fetchRegistry`方法中，先判断是进行增量拉取还是全量拉取：

**1、全量拉取**

当缓存为`null`，或里面的数据为空，或强制时，进行全量拉取，执行`getAndStoreFullRegistry`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bfd78860ceec46f5b94b4cfdd12a7f3b~tplv-k3u1fbpfcp-zoom-1.image)

**2、增量拉取**

只拉取修改的，执行`getAndUpdateDelta`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9e7fc06f2d594c478490160de3441ada~tplv-k3u1fbpfcp-zoom-1.image)

①②：先发送http请求，获取在eureka-server中修改或新增的集合

③：判断，若拉取的集合为null，则进行全量拉取

④：更新操作，在`updateDelta`方法中，根据类型进行更改

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a028a96c01df42e890870cf42a60965e~tplv-k3u1fbpfcp-zoom-1.image)

⑤：获取一致性的hashcode值，用来校验eureka-server集合和本地是否一样

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67d61204782543fab58a7e58353d071c~tplv-k3u1fbpfcp-zoom-1.image)

在这进行判断，若远程集合的hash值等于缓存中的hash值，不需要拉取，否则再进行拉取一次。

最后提一下，`Applications`中定义的以下这些变量，都是在eureka-server中准备好的，直接拉取就可以了。

```java
private final AbstractQueue<Application> applications;
private final Map<String, Application> appNameApplicationMap;
private final Map<String, VipIndexSupport> virtualHostNameAppMap;
private final Map<String, VipIndexSupport> secureVirtualHostNameAppMap;
```

对服务发现过程进行一下重点总结：

- 服务列表的拉取并不是在服务调用的时候才拉取，而是在项目启动的时候就有定时任务去拉取了，这点在`DiscoveryClient`的构造方法中能够体现；
- 服务的实例并不是实时的Eureka-server中的数据，而是一个本地缓存的数据；
- 缓存更新根据实际需求分为全量拉取与增量拉取。

## 集群信息同步

### Eureka-server

集群信息同步发生在Eureka-server之间，之前提到在`PeerAwareInstanceRegistryImpl`类中，在执行`register`方法注册微服务实例完成后，执行了集群信息同步方法`replicateToPeers`，具体分析一下该方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1264f243021e4c34a38048532f60e69f~tplv-k3u1fbpfcp-zoom-1.image)

首先，遍历集群节点，用以给各个集群信息节点进行信息同步。

然后，调用`replicateInstanceActionsToPeers`方法，在该方法中根据具体的操作类型Action，选择分支，最终调用`PeerEurekaNode`的`register`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/493db40c81854a7fa2694746905ebaf9~tplv-k3u1fbpfcp-zoom-1.image)

最终发送http请求，但是与普通注册操作不同的时，这时将集群同步的标识置为true，说明注册信息是来自集群同步。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67857c1af8604d98b22df5b5d597085d~tplv-k3u1fbpfcp-zoom-1.image)

在注册过程中运行到`addInstance`方法时，单独注册时`isReplication`的值为false，集群同步时为true。通过该值，能够避免集群间出现死循环，进行循环同步的问题。


## 最后

到这里，Eureka声明周期中比较重要的六个部分我们就讲完了。由于篇幅有限，只能讲一下大致的流程，如果还想再深入了解一些，不妨自己看看源码，毕竟，源码是最好的老师。