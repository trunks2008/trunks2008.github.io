---
title: Ribbon核心源码解析
icon: page
order: 2
author: Hydra
date: 2020-05-29
tag:
  - Spring Cloud
  - Ribbon
star: true
---



<!-- more -->

Spring cloud Ribbon是基于Netflix Ribbon实现的一套客户端负载均衡工具，简单的说，它能够使用负载均衡器基于某种规则或算法调用我们的微服务集群，并且我们也可以很容易地使用Ribbon实现自定义负载均衡算法。

在之前使用Eureka的过程中，需要导入对应的依赖，但是Ribbon有一点特殊，不需要引入依赖也可以使用。这是因为在Eureka-client中，已经默认为我们集成好了Ribbon，可以直接拿来使用。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67fc600159ce45eb9f069b704bf6939c~tplv-k3u1fbpfcp-zoom-1.image)

根据Spring Boot自动配置原理，先从各个starter的`spring.factories`中寻找可能存在的相关配置类：

- 在spring-cloud-common中，存在自动配置类`LoadBalancerAutoConfiguration`
- 在eureka-client中，存在配置类`RibbonEurekaAutoConfiguration`
- 在ribbon中，存在配置类`RibbonAutoConfiguration`

需要注意，`RibbonEurekaAutoConfiguration`中存在`@AutoConfigureAfter`注解，说明需要在加载`RibbonAutoConfiguration`配置类后再加载当前配置类。这三个类的配置将在后面结合具体代码调试中说明。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a05d603058b34125b1f56330004732f4~tplv-k3u1fbpfcp-zoom-1.image)

下面我们通过代码调试的方式来探究Ribbon的运行流程。

## 调用流程

Ribbon的调用过程非常简单，使用`RestTemplate`加上`@LoadBalanced`注解就可以开启客户端的负载均衡，写一个简单的测试用例进行测试：

```java
@Bean
@LoadBalanced
public RestTemplate restTemplate(){
   return new RestTemplate();
}
    
@GetMapping("/test")
public String test(String service){
    String result=restTemplate.getForObject("http://eureka-hi/"+service,String.class);
    System.out.println(result);
    return result;
}
```

结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f14a9141912d42f9be59954e1cc504b0~tplv-k3u1fbpfcp-zoom-1.image)

通过结果可以看出，`RestTemplate`基于服务名称，即可实现访问Eureka-client集群下的不同服务实例，实现负载均衡的调用方式。看一下`@LoadBalanced`注解的定义：

```java
/**
 * Annotation to mark a RestTemplate bean to be configured to use a LoadBalancerClient
 * @author Spencer Gibb
 */
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@Qualifier
public @interface LoadBalanced {
}
```

注释说明了`@LoadBalanced`用于注解在`RestTemplate`上实现负载均衡，那么来看一下`@LoadBalanced`注解是如何生效的呢？回到前面提到的配置类`LoadBalancerAutoConfiguration`中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39cf2d7ac2e846e9ab4ae8a5548ef458~tplv-k3u1fbpfcp-zoom-1.image)

在配置类中定义了一个`LoadBalancerInterceptor`拦截器，并且为`restTemplate`添加了这个拦截器。在`restTemplate`每次执行方法请求时，都会调用`intercept`方法执行拦截：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8f03e749020f48f08abe60d61cf75629~tplv-k3u1fbpfcp-zoom-1.image)

在上面的`intercept`拦截方法中，首先获取本次访问的url地址，从中获取本次要访问的服务名，然后调用`RibbonLoadBalancerClient`中的`execute`方法。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b103dfd59dce4e6d9339220ad7a76ac2~tplv-k3u1fbpfcp-zoom-1.image)

在这里通过服务名获取了该服务对应的负载均衡器`ILoadBalancer`的实例对象，然后调用该实例的`chooseServer`方法获取一个可用服务实例，关于`ILoadBalancer`会在后面具体介绍。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66b5679f5fd84aad92017129d96ee3cf~tplv-k3u1fbpfcp-zoom-1.image)

在`execute`方法调用`apply`方法的过程中，会调用`LoadBalancerContext`的`reconstructURIWithServer`方法重构将要访问的`url`地址：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c971945013a94998882273b3ed1e87cf~tplv-k3u1fbpfcp-zoom-1.image)

在拼接完成`url`后，调用`AbstractClientHttpRequest`类的`execute`方法发送请求。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b4f9004454054ab9a7e0b7c85bc9cf36~tplv-k3u1fbpfcp-zoom-1.image)

调用`executeInternal`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/18fa27e6bdf741cb821d8bffac6ea816~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，最终`RestTemplate`底层调用了`HttpURLConnection`来发送请求。

总体的调用流程我们总结完了，那么负载均衡的过程究竟是如何实现的呢？我们来详细梳理一下。

## 负载均衡过程

在Ribbon中有个非常重要的组件`LoadBalancerClient`，它是负载均衡的一个客户端，我们从这入手写一个测试接口：

```java
@Autowired
private LoadBalancerClient loadBalancerClient;

@GetMapping("/choose")
public String loadBalance(String serviceId){
    ServiceInstance instance = loadBalancerClient.choose(serviceId);
    System.out.println(instance.getHost()+" "+instance.getPort());
    return "ok";
}
```

调用接口测试结果，可以看出是通过`LoadBalancerClient` 的`choose`方法，选择调用了不同端口上的服务实例，体现了负载均衡：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b576b88ab8b147049f1b76017e6fea1a~tplv-k3u1fbpfcp-zoom-1.image)

对代码进行调试，发现注入的`LoadBalancerClient`的实现类正是之前看见过的`RibbonLoadBalancerClient`，进入其`choos`方法中，先后调用两次`getServer`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6a5086fb6b0c4d59bbf1cd0031b97ef0~tplv-k3u1fbpfcp-zoom-1.image)

此时`loadBalancer`实例对象为`ZoneAwareLoadBalancer`，并且里面的`allServerList`列表已经缓存了所有的服务列表。调用`chooseServer`方法，由于此时我们只有一个`zone`，所以默认调用父类`BaseLoadBalancer`的`chooseServer`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3eb174bc196b46d5bd534a27a8bf7375~tplv-k3u1fbpfcp-zoom-1.image)

在父类的方法中，根据`IRule`实例定义的规则来确定返回哪一个具体的Server：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/805a761a9651469b8c808892703bc961~tplv-k3u1fbpfcp-zoom-1.image)

这里的`IRule`实现使用了默认的`ZoneAvoidanceRule`，为区域内亲和选择算法。关于`IRule`负载均衡算法在后面再做介绍。由于`ZoneAvoidanceRule`中没有实现`choose`方法，直接调用其父类`PredicateBasedRule`的`choose`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/184957b846ec4da2bf9a17a2d46509ba~tplv-k3u1fbpfcp-zoom-1.image)

调用`AbstractServerPredicate`的`chooseRoundRobinAfterFiltering`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/58452fe6df254a52a714898590a03f6d~tplv-k3u1fbpfcp-zoom-1.image)

实现非常简单，通过轮询的方式选择下标：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14afbc13560c495d9e52df45175147a1~tplv-k3u1fbpfcp-zoom-1.image)

返回`choose`方法中，可以看到已经获得了一个server实例：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c8a075fab1184416b7d2f603dcfab471~tplv-k3u1fbpfcp-zoom-1.image)

## 核心组件ILoadBalancer

返回服务实例的调用过程大体已经了解了，但是我们在上篇中略过了一个内容，就是获取`LoadBalancer`的过程，回去看第一次调用的`getServer`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39724dcf1ec54b50b5d7078f90229088~tplv-k3u1fbpfcp-zoom-1.image)

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a9b617432a1f4568ab1b824cae8f4d56~tplv-k3u1fbpfcp-zoom-1.image)

这里通过`getLoadBalancer`方法返回一个`ILoadBalancer`负载均衡器，具体调用了Spring的`BeanFactoryUtil`，通过`getBean`方法从spring容器中获取类型匹配的bean实例：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c77a81203cf444285373de045205a08~tplv-k3u1fbpfcp-zoom-1.image)

回到前面`getServer`方法调用的那张图，你就会发现这时候已经返回了一个`ZoneAwareLoadBalancer`，并且其中已经保存好了服务列表。看一下`ILoadBalancer` 的接口定义：

```java
public interface ILoadBalancer {
  //往该ILoadBalancer中添加服务
  public void addServers(List<Server> newServers);
  //选择一个可以调用的实例，keyb不是服务名称，而是zone的id
  public Server chooseServer(Object key);
  //标记下线服务
  public void markServerDown(Server server);
  @Deprecated
  public List<Server> getServerList(boolean availableOnly);
  //获取可用服务列表
  public List<Server> getReachableServers();
  //获取所有服务列表
  public List<Server> getAllServers();
}
```

该接口定义了Ribbon中核心的两项内容，**服务获取**与**服务选择**，可以说，`ILoadBalancer`是Ribbon中最重要的一个组件，它起到了承上启下的作用，既要连接 Eureka获取服务地址，又要调用`IRule`利用负载均衡算法选择服务。下面分别介绍。

### 服务获取

Ribbon在选择之前需要获取服务列表，而Ribbon本身不具有服务发现的功能，所以需要借助Eureka来解决获取服务列表的问题。回到文章开头说到的配置类`RibbonEurekaAutoConfiguration`：

```java
@Configuration
@EnableConfigurationProperties
@ConditionalOnRibbonAndEurekaEnabled
@AutoConfigureAfter(RibbonAutoConfiguration.class)
@RibbonClients(defaultConfiguration = EurekaRibbonClientConfiguration.class)
public class RibbonEurekaAutoConfiguration {
}
```

其中定义了其默认配置类为`EurekaRibbonClientConfiguration`，在它的`ribbonServerList`方法中创建了服务发现组件`DiscoveryEnabledNIWSServerList`：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6f097ea36b64406c80290a91621923e0~tplv-k3u1fbpfcp-zoom-1.image)

`DiscoveryEnabledNIWSServerList`实现了`ServerList`接口，该接口用于初始化服务列表及更新服务列表。首先看一下`ServerList`的接口定义，其中两个方法分别用于初始化服务列表及更新服务列表：

```java
public interface ServerList<T extends Server> {
    public List<T> getInitialListOfServers();
    public List<T> getUpdatedListOfServers();   
}
```

在`DiscoveryEnabledNIWSServerList`中，初始化与更新两个方法其实调用了同一个方法来实现具体逻辑：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/05d77f6284da433ab561e6c2c8a35e1e~tplv-k3u1fbpfcp-zoom-1.image)

进入`obtainServersViaDiscovery`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8eb9eb763d0549418dabdea944b8d159~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，这里先得到一个`EurekaClient`的实例，然后借助`EurekaClient`的服务发现功能，来获取服务的实例列表。在获取了实例信息后，判断服务的状态如果为`UP`，那么最终将它加入`serverList`中。

在获取得到`serverList`后，会进行缓存操作。首先进入`DynamicServerListLoadBalancer`的`setServerList`方法，然后调用父类`BaseLoadBalancer`的`setServersList`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b0718ad91b04588bd56660b5376704a~tplv-k3u1fbpfcp-zoom-1.image)

在`BaseLoadBalancer`中，定义了两个缓存列表：

```java
protected volatile List<Server> allServerList = Collections.synchronizedList(new ArrayList<Server>());
protected volatile List<Server> upServerList = Collections.synchronizedList(new ArrayList<Server>());
```

在父类的`setServersList`中，将拉取的`serverList`赋值给缓存列表`allServerList`：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/962fc733c272496fad2102c76e941779~tplv-k3u1fbpfcp-zoom-1.image)

在Ribbon从Eureka中得到了服务列表，缓存在本地List后，存在一个问题，如何保证在调用服务的时候服务仍然处于可用状态，也就是说应该如何解决缓存列表脏读问题？

在默认负载均衡器`ZoneAwareLoadBalancer`的父类`BaseLoadBalancer`构造方法中，调用`setupPingTask`方法，并在其中创建了一个定时任务，使用`ping`的方式判断服务是否可用：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/590f1869583441bc8ff24a3fbc0c1eac~tplv-k3u1fbpfcp-zoom-1.image)

`runPinger`方法中，调用`SerialPingStrategy`的`pingServers`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b0f1e2e347994d2d9d29a09a391c4094~tplv-k3u1fbpfcp-zoom-1.image)

`pingServers`方法中，调用`NIWSDiscoveryPing`的`isAlive`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9ca5f92b6ee74b14b613300d737a9856~tplv-k3u1fbpfcp-zoom-1.image)

`NIWSDiscoveryPing`实现了`IPing`接口，在`IPing` 接口中，仅有一个`isAlive`方法用来判断服务是否可用：

```java
public interface IPing {
    public boolean isAlive(Server server);
}
```

`NIWSDiscoveryPing`的`isAlive`方法实现：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ba4d9673269643a9adb26d2db809ec3d~tplv-k3u1fbpfcp-zoom-1.image)

因为本地的`serverList`为缓存值，可能与eureka中不同，所以从eureka中去查询该实例的状态，如果eureka里面显示该实例状态为`UP`，就返回true，说明服务可用。

返回`Pinger`的`runPingger`的方法调用处：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/00b432fb6ed84a54ace1d3fa543ae8c5~tplv-k3u1fbpfcp-zoom-1.image)

在获取到服务的状态列表后进行循环，如果状态改变，加入到`changedServers`中，并且把所有可用服务加入`newUpList`，最终更新`upServerList`中缓存值。但是在阅读源码中发现，创建了一个监听器用于监听`changedServers`这一列表，但是只是一个空壳方法，并没有实际代码对列表变动做出实际操作。

需要注意的是，在调试过程中当我下线一个服务后，`results`数组并没有按照预期的将其中一个服务的状态返回为false，而是`results`数组中的元素只剩下了一个，也就说明，除了使用ping的方式去检测服务是否在线外，Ribbon还使用了别的方式来更新服务列表。

我们在`BaseLoadBalancer`的`setServersList`方法中添加一个断点：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7f508a47a7134ac68dd404587ed9cc35~tplv-k3u1fbpfcp-zoom-1.image)

等待程序运行，可以发现，在还没有进入执行`IPing`的定时任务前，已经将下线服务剔除，只剩下了一个可用服务。查看调用链，最终可以发现使用了定时调度线程池调用了`PollingServerListUpdater`类的`start`方法，来进行更新服务操作：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0df858ca7444356a48291a70cc9169d~tplv-k3u1fbpfcp-zoom-1.image)

回到`BaseLoadBalancer`的`setServersList`方法中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/868d0a3f55ea41008798b8459affc4a2~tplv-k3u1fbpfcp-zoom-1.image)

在这里就用新的服务列表更新了旧服务列表，因此当执行`IPing`的线程再执行时，服务列表中只剩下了一个服务实例。

综上可以发现，Ribbon为了解决服务列表的脏读现象，采用了两种手段：

- 更新列表
- ping机制

在测试中发现，更新机制和ping机制功能基本重合，并且在ping的时候不能执行更新，在更新的时候不能运行ping，所以很难检测到ping失败的情况。

### 服务选取

服务选取的过程就是从服务列表中按照约定规则选取服务实例，与负载均衡算法相关。这里引入Ribbon对于负载均衡策略实现的接口`IRule`：

```java
public interface IRule{
    public Server choose(Object key);
    public void setLoadBalancer(ILoadBalancer lb);    
    public ILoadBalancer getLoadBalancer();    
}
```

其中`choose`为核心方法，用于实现具体的选择逻辑。

Ribbon中，下面7个类默认实现了`IRule`接口，为我们提供负载均衡算法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f9d26786e0b14e62a9d545e1ccd4e9be~tplv-k3u1fbpfcp-zoom-1.image)

在刚才调试过程中，可以知道Ribbon默认使用的是`ZoneAvoidanceRule`区域亲和负载均衡算法，优先调用一个`zone`区间中的服务，并使用轮询算法，具体实现过程前面已经介绍过不再赘述。

当然，也可以由我们自己实现`IRule`接口，重写其中的`choose`方法来实现自己的负载均衡算法，然后通过`@Bean`的方式注入到spring容器中。当然也可以将不同的服务应用不同的`IRule`策略，这里需要注意的是，Spring cloud的官方文档中提醒我们，如果多个微服务要调用不同的`IRule`，那么创建出`IRule`的配置类不能放在`ComponentScan`的目录下面，这样所有的微服务都会使用这一个策略。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d8f28b9b5e6a48368b6780d9401c7887~tplv-k3u1fbpfcp-zoom-1.image)

需要在主程序运行的com包外另外创建一个config包用于专门存放配置类，然后在启动类上加上`@RibbonClients`注解，不同服务应用不同配置类：

```java
@RibbonClients({@RibbonClient(name="eureka-hi",configuration = HiRuleConfig.class),
        @RibbonClient(name = "eureka-test",configuration = TestRuleConfig.class)})
public class ServiceFeignApplication {
……
}
```

## 总结

综上所述，在Ribbon的负载均衡中，大致可以分为以下几步：

- 拦截请求，通过请求中的url地址，截取服务名称 
- 通过`LoadBalancerClient`获取`ILoadBalancer`
- 使用Eureka获取服务列表
- 通过`IRule`负载均衡策略选择具体服务
- `ILoadBalancer`通过`IPing`及定时更新机制来维护服务列表
- 重构该url地址，最终调用`HttpURLConnection`发起请求

了解了整个调用流程后，我们更容易明白为什么Ribbon叫做客户端的负载均衡。与nginx服务端负载均衡不同，nginx在使用反向代理具体服务的时候，调用端不知道都有哪些服务。而Ribbon在调用之前，已经知道有哪些服务可用，直接通过本地负载均衡策略调用即可。而在实际使用过程中，也可以根据需要，结合两种方式真正实现高可用。