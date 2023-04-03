---
title: 实战派 | Java项目中玩转Redis6.0客户端缓存！
icon: page
order: 14
author: Hydra
date: 2022-05-11
tag:
  - Redis
star: true
---



<!-- more -->

在前面的文章中，我们介绍了Redis6.0中的新特性客户端缓存`client-side caching`，通过telnet连接模拟客户端，测试了三种客户端缓存的工作模式，这篇文章我们就来点硬核实战，看看客户端缓存在java项目中应该如何落地。

## 铺垫

首先介绍一下今天要使用到的工具`Lettuce`，它是一个可伸缩线程安全的redis客户端。多个线程可以共享同一个`RedisConnection`，利用nio框架`Netty`来高效地管理多个连接。

放眼望向现在常用的redis客户端开发工具包，虽然能用的不少，但是目前率先拥抱redis6.0，支持客户端缓存功能的却不多，而lettuce就是其中的领跑者。

我们先在项目中引入最新版本的依赖，下面正式开始实战环节：

```xml
<dependency>
    <groupId>io.lettuce</groupId>
    <artifactId>lettuce-core</artifactId>
    <version>6.1.8.RELEASE</version>
</dependency>
```

## 实战

在项目中应用lettuce，开启并使用客户端缓存功能，只需要下面这一段代码：

```java
public static void main(String[] args) throws InterruptedException {
    // 创建 RedisClient 连接信息
    RedisURI redisURI= RedisURI.builder()
            .withHost("127.0.0.1")
            .withPort(6379)
            .build();
    RedisClient client = RedisClient.create(redisURI);
    StatefulRedisConnection<String, String> connect = client.connect();
    
    Map<String, String> map = new HashMap<>();
    CacheFrontend<String,String> frontend=ClientSideCaching.enable(CacheAccessor.forMap(map),
            connect, TrackingArgs.Builder.enabled().noloop());

    String key="user";
    while (true){
        String value = frontend.get(key);
        System.out.println(value);
        TimeUnit.SECONDS.sleep(10);
    }
}
```

上面的代码主要完成了几项工作：

- 通过`RedisURI`配置redis连接的标准信息，并建立连接
- 创建用于充当本地缓存的`Map`，开启客户端缓存功能，建立一个缓存访问器`CacheFrontend`
- 在循环中使用`CacheFrontend`，不断查询同一个key对应的值并打印

启动上面的程序，控制台会不断的打印`user`对应的缓存，在启动一段时间后，我们在其他的客户端修改`user`对应的值，运行的结果如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24be3e04522744939dc2be7252141073~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，在其他客户端修改了key所对应的值后，打印结果也发生了变化。但是到这里，我们也不知道`lettuce`是不是真的使用了客户端缓存，虽然结果正确，但是说不定是它每次都重新执行了`get`命令呢？

所以我们下面来看看源码，分析一下具体的代码执行流程。

## 分析

在上面的代码中，最关键的类就是`CacheFrontend`了，我们再来仔细看一下上面具体实例化时的语句：

```java
CacheFrontend<String,String> frontend=ClientSideCaching.enable(
        CacheAccessor.forMap(map),
        connect,
        TrackingArgs.Builder.enabled().noloop()
);
```

首先调用了`ClientSideCaching`的`enable()`方法，我们看一下它的源码：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6998b61b4d3242f187dc06668e6b880b~tplv-k3u1fbpfcp-zoom-1.image)

解释一下传入的3个参数：

- `CacheAccessor`：一个定义对客户端缓存进行访问接口，上面调用它的`forMap`方法返回的是一个`MapCacheAccessor`，它的底层使用的我们自定义的`Map`来存放本地缓存，并且提供了`get`、`put`、`evict`等方法操作`Map`
- `StatefulRedisConnection`：使用到的redis连接
- `TrackingArgs`：客户端缓存的参数配置，使用`noloop`后不会接收当前连接修改key后的通知

向redis服务端发送开启`tracking`的命令后，继续向下调用`create()`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c1fdebdd790b4a769f17d6b1ad9a3ec7~tplv-k3u1fbpfcp-zoom-1.image)

这个过程中实例化了一个重要对象，它就是实现了`RedisCache`接口的`DefaultRedisCache`对象，实际向redis执行查询时的`get`请求、写入的`put`请求，都是由它来完成。

实例化完成后，继续向下调用同名的`create()`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/86b4e171be3648dc81acd58abe122857~tplv-k3u1fbpfcp-zoom-1.image)

在这个方法中，实例化了`ClientSideCaching`对象，注意一下传入的两个参数，通过前面的介绍也很好理解它们的分工：

- 当本地缓存存在时，直接从`CacheAccessor`中读取
- 当本地缓存不存在时，使用`RedisCache`从服务端读取

需要额外注意一下的是返回前的两行代码，先看第一句（行号**114**的那行）。

这里向`RedisCache`添加了一个监听，当监听到类型为`invalidate`的作废消息时，拿到要作废的key，传递给消费者。一般情况下，`keys`中只会有一个元素。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ba0c731445fc42b6927914eb75939894~tplv-k3u1fbpfcp-zoom-1.image)

消费时会遍历当前`ClientSideCaching`的消费者列表`invalidationListeners`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a22e038333040f0a4c5474dcaf4f6c4~tplv-k3u1fbpfcp-zoom-1.image)

而这个列表中的所有，就是在上面的第二行代码中（行号**115**的那行）添加的，看一下方法的定义：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/53a93d5983904aae933c12cca40bd894~tplv-k3u1fbpfcp-zoom-1.image)

而实际传入的方法引用则是下面`MapCacheAccessor`的`evict()`方法，也就是说，当收到key作废的消息后，会移除掉本地缓存`Map`中缓存的这个数据。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6ead3a6490e1414ebbe288c1c8578325~tplv-k3u1fbpfcp-zoom-1.image)

客户端缓存的**作废**逻辑我们梳理清楚了，再来看看它是何时写入的，直接看`ClientSideCaching`的`get()`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab46b916155b4d8cb76b927b9a2c42ef~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，`get`方法会先从本地缓存`MapCacheAccessor`中尝试获取，如果取到则直接返回，如果没有再使用`RedisCache`读取redis中的缓存，并将返回的结果存入到`MapCacheAccessor`中。

## 图解

源码看到这里，是不是基本逻辑就串联起来了，我们再画两张图来梳理一下这个流程。先看`get`的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6c200310f025449d9793da62a63ba763~tplv-k3u1fbpfcp-zoom-1.image)

再来看一下通知客户端缓存失效的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cc374544cce34ea2be88e7742fdf2279~tplv-k3u1fbpfcp-zoom-1.image)

怎么样，配合这两张图再理解一下，是不是很完美？

其实也不是…回忆一下我们之前使用两级缓存`Caffeine+Redis`时，当时使用的通知机制，会在修改redis缓存后通知所有主机修改本地缓存，修改成为最新的值。目前的lettuce看来，显然不满足这一功能，只能做到作废删除缓存但是不会主动更新。

## 扩展

那么，如果想实现本地客户端缓存的**实时更新**，我们应该如何在现在的基础上进行扩展呢？仔细想一下的话，思路也很简单：

- 首先，移除掉`lettuce`的客户端缓存本身自带的作废消息监听器
- 然后，添加我们自己的作废消息监听器

回顾一下上面源码分析的图，在调用`DefaultRedisCache`的`addInvalidationListener()`方法时，其实是调用的是`StatefulRedisConnection`的`addListener()`方法，也就是说，这个监听器其实是添加在redis连接上的。

如果我们再看一下这个方法源码的话，就会发现，在它的附近还有一个对应的`removeListener()`方法，一看就是我们要找的东西，准备用它来移除消息监听。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0c826594cedc43ccb5c7a4b2197d75f1~tplv-k3u1fbpfcp-zoom-1.image)

不过再仔细看看，这个方法是要传参数的啊，我们明显不知道现在里面已经存在的`PushListener`有什么，所以没法直接使用，那么无奈只能再接着往下看看这个`pushHandler`是什么玩意…

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9a1932e36b46470f8e1b0be4bdc3b71f~tplv-k3u1fbpfcp-zoom-1.image)

通过注释可以知道，这个`PushHandler`就是一个用来操作`PushListener`的处理工具，虽然我们不知道具体要移除的`PushListener`是哪一个，但是惊喜的是，它提供了一个`getPushListeners()`方法，可以获取当前所有的监听器。

这样一来就简单了，我上来直接清除掉这个集合中的所有监听器，问题就迎刃而解了~

不过，在`StatefulRedisConnectionImpl`中的`pushHandler`是一个私有对象，也没有对外进行暴露，想要操作起来还是需要费上一点功夫的。下面，我们就在分析的结果上进行代码的修改。

## 魔改

首先，我们需要自定义一个工具类，它的主要功能是操作监听器，所以就命名为`ListenerChanger`好了。它要完成的功能主要有三个：

- 移除原有的全部消息监听
- 添加新的自定义消息监听
- 更新本地缓存`MapCacheAccessor`中的数据

首先定义构造方法，需要传入`StatefulRedisConnection`和`CacheAccessor`作为参数，在后面的方法中会用到，并且创建一个`RedisCommands`，用于后面向redis服务端发送`get`命令请求。

```java
public class ListenerChanger<K, V> {
    private StatefulRedisConnection<K, V> connection;
    private CacheAccessor<K, V> mapCacheAccessor;
    private RedisCommands<K, V> command;

    public ListenerChanger(StatefulRedisConnection<K, V> connection,
                           CacheAccessor<K, V> mapCacheAccessor) {
        this.connection = connection;
        this.mapCacheAccessor = mapCacheAccessor;
        this.command = connection.sync();
    }
    
    //其他方法先省略……
}
```

### 移除监听

前面说过，`pushHandler`是一个私有对象，我们无法直接获取和操作，所以只能先使用反射获得。`PushHandler`中的监听器列表存储在一个`CopyOnWriteArrayList`中，我们直接使用迭代器移除掉所有内容即可。

```java
public void removeAllListeners() {
    try {
        Class connectionClass = StatefulRedisConnectionImpl.class;
        Field pushHandlerField = connectionClass.getDeclaredField("pushHandler");
        pushHandlerField.setAccessible(true);
        PushHandler pushHandler = (PushHandler) pushHandlerField.get(this.connection);

        CopyOnWriteArrayList<PushListener> pushListeners
                = (CopyOnWriteArrayList) pushHandler.getPushListeners();
        Iterator<PushListener> it = pushListeners.iterator();
        while (it.hasNext()) {
            PushListener listener = it.next();
            pushListeners.remove(listener);
        }
    } catch (NoSuchFieldException | IllegalAccessException e) {
        e.printStackTrace();
    }
}
```

### 添加监听

这里我们模仿`DefaultRedisCache`中`addInvalidationListener()`方法的写法，添加一个监听器，除了最后处理的代码基本一致。对于监听到的要作废的`keys`集合，另外启动一个线程更新本地数据。

```java
public void addNewListener() {
    this.connection.addListener(new PushListener() {
        @Override
        public void onPushMessage(PushMessage message) {
            if (message.getType().equals("invalidate")) {
                List<Object> content = message.getContent(StringCodec.UTF8::decodeKey);
                List<K> keys = (List<K>) content.get(1);
                System.out.println("modifyKeys:"+keys);

                // start a new thread to update cacheAccessor
                new Thread(()-> updateMap(keys)).start();
            }
        }
    });
}
```

### 本地更新

使用`RedisCommands`重新从redis服务端获取最新的数据，并更新本地缓存`mapCacheAccessor`中的数据。

```java
private void updateMap(List<K> keys){
    for (K key : keys) {
        V newValue = this.command.get(key);
        System.out.println("newValue:"+newValue);
        mapCacheAccessor.put(key, newValue);
    }
}
```

至于为什么执行这个方法时额外启动了一个新线程，是因为我在测试中发现，当在`PushListener`的`onPushMessage`方法中执行`RedisCommands`的`get()`方法时，会一直取不到值，但是像这样新启动一个线程就没有问题。

## 测试

下面，我们来写一段测试代码，来测试上面的改动。

```java
public static void main(String[] args) throws InterruptedException {
	// 省略之前创建连接代码……
    
    Map<String, String> map = new HashMap<>();
    CacheAccessor<String, String> mapCacheAccessor = CacheAccessor.forMap(map);
    CacheFrontend<String, String> frontend = ClientSideCaching.enable(mapCacheAccessor,
            connect,
            TrackingArgs.Builder.enabled().noloop());

    ListenerChanger<String, String> listenerChanger
            = new ListenerChanger<>(connect, mapCacheAccessor);
    // 移除原有的listeners
    listenerChanger.removeAllListeners();
    // 添加新的监听器
    listenerChanger.addNewListener();

    String key = "user";
    while (true) {
        String value = frontend.get(key);
        System.out.println(value);
        TimeUnit.SECONDS.sleep(30);
    }
}
```

可以看到，代码基本上在之前的基础上没有做什么改动，只是在创建完`ClientSideCaching`后，执行了我们自己实现的`ListenerChanger`的两个方法。先移除所有监听器、再添加新的监听器。下面我们以debug模式启动测试代码，简单看一下代码的执行逻辑。

首先，在未执行移除操作前，`pushHandler`中的监听器列表中有一个监听器：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c47a44ec60d4b92b9d66f88c08620b6~tplv-k3u1fbpfcp-zoom-1.image)

移除后，监听器列表为空：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d20e88ed1af0457ea85c9d7b0bba24e7~tplv-k3u1fbpfcp-zoom-1.image)

在添加完自定义监听器、并且执行完第一次查询操作后，在另外一个redis客户端中修改`user`的值，这时`PushListener`会收到作废类型的消息监听：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a275adebc590491fb0794e331290094c~tplv-k3u1fbpfcp-zoom-1.image)

启动一个新线程，查询redis中`user`对应的最新值，并放入`cacheAccessor`中：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/04b3256ac4f84f10858888be2837d096~tplv-k3u1fbpfcp-zoom-1.image)

当循环中`CacheFrontend`的`get()`方法再被执行时，会直接从`cacheAccessor`中取到刷新后的值，不需要再次去访问redis服务端了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f116d7191d74727a0ae8c3cfbed713c~tplv-k3u1fbpfcp-zoom-1.image)

## 总结

到这里，我们基于`lettuce`的客户端缓存的基本使用、以及在这个基础上进行的魔改就基本完成了。可以看到，`lettuce`客户端已经在底层封装了一套比较成熟的API，能让我们在将redis升级到6.0以后，开箱即用式地使用客户端缓存这一新特性。在使用中，不需要我们关注底层原理，也不用做什么业务逻辑的改造，总的来说，使用起来还是挺香的。

那么，这次的分享就到这里，我是Hydra，下篇文章再见。


