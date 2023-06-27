---
title: 服务限流，我有6种实现方式…
icon: page
order: 9
author: Hydra
date: 2023-05-10
tag:
  - 并发
  - 限流
star: true
---



<!-- more -->

哈喽大家好啊，我是Hydra，今天来和大家聊聊服务的限流。

服务限流，是指通过控制请求的速率或次数来达到保护服务的目的，在微服务中，我们通常会将它和熔断、降级搭配在一起使用，来避免瞬时的大量请求对系统造成负荷，来达到保护服务平稳运行的目的。下面就来看一看常见的6种限流方式，以及它们的实现与使用。

## 固定窗口算法

固定窗口算法通过在单位时间内维护一个计数器，能够限制在每个固定的时间段内请求通过的次数，以达到限流的效果。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03276f0041b14f089d0c3cad9984319e~tplv-k3u1fbpfcp-zoom-1.image)

算法实现起来也比较简单，可以通过构造方法中的参数指定时间窗口大小以及允许通过的请求数量，当请求进入时先比较当前时间是否超过窗口上边界，未越界且未超过计数器上限则可以放行请求。

```java
@Slf4j
public class FixedWindowRateLimiter {
    // 时间窗口大小，单位毫秒
    private long windowSize;
    // 允许通过请求数
    private int maxRequestCount;

    // 当前窗口通过的请求计数
    private AtomicInteger count=new AtomicInteger(0);
    // 窗口右边界
    private long windowBorder;

    public FixedWindowRateLimiter(long windowSize,int maxRequestCount){
        this.windowSize = windowSize;
        this.maxRequestCount = maxRequestCount;
        windowBorder = System.currentTimeMillis()+windowSize;
    }

    public synchronized boolean tryAcquire(){
        long currentTime = System.currentTimeMillis();
        if (windowBorder < currentTime){
            log.info("window  reset");
            do {
                windowBorder += windowSize;
            }while(windowBorder < currentTime);
            count=new AtomicInteger(0);
        }

        if (count.intValue() < maxRequestCount){
            count.incrementAndGet();
            log.info("tryAcquire success");
            return true;
        }else {
            log.info("tryAcquire fail");
            return false;
        }
    }
}
```

进行测试，允许在1000毫秒内通过5个请求：

```java
void test() throws InterruptedException {
    FixedWindowRateLimiter fixedWindowRateLimiter
            = new FixedWindowRateLimiter(1000, 5);

    for (int i = 0; i < 10; i++) {
        if (fixedWindowRateLimiter.tryAcquire()) {
            System.out.println("执行任务");
        }else{
            System.out.println("被限流");
            TimeUnit.MILLISECONDS.sleep(300);
        }
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ac84d0e43d924dfeafadb0e08848fc7d~tplv-k3u1fbpfcp-zoom-1.image)

固定窗口算法的优点是实现简单，但是可能无法应对突发流量的情况，比如每秒允许放行100个请求，但是在0.9秒前都没有请求进来，这就造成了在0.9秒到1秒这段时间内要处理100个请求，而在1秒到1.1秒间可能会再进入100个请求，这就造成了要在0.2秒内处理200个请求，这种流量激增就可能导致后端服务出现异常。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/32cc5a2ded534d69916e5bc7629e6217~tplv-k3u1fbpfcp-zoom-1.image)

## 滑动窗口算法

滑动窗口算法在固定窗口的基础上，进行了一定的升级改造。它的算法的核心在于将时间窗口进行了更精细的分片，将固定窗口分为多个小块，每次仅滑动一小块的时间。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d13ab3ee9a1d463d9e055a66188d1bd8~tplv-k3u1fbpfcp-zoom-1.image)

并且在每个时间段内都维护了单独的计数器，每次滑动时，都减去前一个时间块内的请求数量，并再添加一个新的时间块到末尾，当时间窗口内所有小时间块的计数器之和超过了请求阈值时，就会触发限流操作。

看一下算法的实现，核心就是通过一个`int`类型的数组循环使用来维护每个时间片内独立的计数器：

```java
@Slf4j
public class SlidingWindowRateLimiter {
    // 时间窗口大小，单位毫秒
    private long windowSize;
    // 分片窗口数
    private int shardNum;
    // 允许通过请求数
    private int maxRequestCount;
    // 各个窗口内请求计数
    private int[] shardRequestCount;
    // 请求总数
    private int totalCount;
    // 当前窗口下标
    private int shardId;
    // 每个小窗口大小，毫秒
    private long tinyWindowSize;
    // 窗口右边界
    private long windowBorder;

    public SlidingWindowRateLimiter(long windowSize, int shardNum, int maxRequestCount) {
        this.windowSize = windowSize;
        this.shardNum = shardNum;
        this.maxRequestCount = maxRequestCount;
        shardRequestCount = new int[shardNum];
        tinyWindowSize = windowSize/ shardNum;
        windowBorder=System.currentTimeMillis();
    }

    public synchronized boolean tryAcquire() {
        long currentTime = System.currentTimeMillis();
        if (currentTime > windowBorder){
            do {
                shardId = (++shardId) % shardNum;
                totalCount -= shardRequestCount[shardId];
                shardRequestCount[shardId]=0;
                windowBorder += tinyWindowSize;
            }while (windowBorder < currentTime);
        }

        if (totalCount < maxRequestCount){
            log.info("tryAcquire success,{}",shardId);
            shardRequestCount[shardId]++;
            totalCount++;
            return true;
        }else{
            log.info("tryAcquire fail,{}",shardId);
            return false;
        }
    }

}
```

进行一下测试，对第一个例子中的规则进行修改，每1秒允许100个请求通过不变，在此基础上再把每1秒等分为10个0.1秒的窗口。

```java
void test() throws InterruptedException {
    SlidingWindowRateLimiter slidingWindowRateLimiter
            = new SlidingWindowRateLimiter(1000, 10, 10);
    TimeUnit.MILLISECONDS.sleep(800);

    for (int i = 0; i < 15; i++) {
        boolean acquire = slidingWindowRateLimiter.tryAcquire();
        if (acquire){
            System.out.println("执行任务");
        }else{
            System.out.println("被限流");
        }
        TimeUnit.MILLISECONDS.sleep(10);
    }
}
```

查看运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/deaba8aaeba4466bb5908d9dc6874f5f~tplv-k3u1fbpfcp-zoom-1.image)

程序启动后，在先休眠了一段时间后再发起请求，可以看到在0.9秒到1秒的时间窗口内放行了6个请求，在1秒到1.1秒内放行了4个请求，随后就进行了限流，解决了在固定窗口算法中相邻时间窗口内允许通过大量请求的问题。

滑动窗口算法通过将时间片进行分片，对流量的控制更加精细化，但是相应的也会浪费一些存储空间，用来维护每一块时间内的单独计数，并且还没有解决固定窗口中可能出现的流量激增问题。

## 漏桶算法

为了应对流量激增的问题，后续又衍生出了漏桶算法，用专业一点的词来说，漏桶算法能够进行流量整形和流量控制。

漏桶是一个很形象的比喻，外部请求就像是水一样不断注入水桶中，而水桶已经设置好了最大出水速率，漏桶会以这个速率匀速放行请求，而当水超过桶的最大容量后则被丢弃。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cac5a8316ee041018ba18cf163ab7dce~tplv-k3u1fbpfcp-zoom-1.image)

看一下代码实现：

```java
@Slf4j
public class LeakyBucketRateLimiter {
    // 桶的容量
    private int capacity;
    // 桶中现存水量
    private AtomicInteger water=new AtomicInteger(0);
    // 开始漏水时间
    private long leakTimeStamp;
    // 水流出的速率，即每秒允许通过的请求数
    private int leakRate;

    public LeakyBucketRateLimiter(int capacity,int leakRate){
        this.capacity=capacity;
        this.leakRate=leakRate;
    }

    public synchronized boolean tryAcquire(){
        // 桶中没有水，重新开始计算
        if (water.get()==0){
            log.info("start leaking");
            leakTimeStamp = System.currentTimeMillis();
            water.incrementAndGet();
            return water.get() < capacity;
        }

        // 先漏水，计算剩余水量
        long currentTime = System.currentTimeMillis();
        int leakedWater= (int) ((currentTime-leakTimeStamp)/1000 * leakRate);
        log.info("lastTime:{}, currentTime:{}. LeakedWater:{}",leakTimeStamp,currentTime,leakedWater);

        // 可能时间不足,则先不漏水
        if (leakedWater != 0){
            int leftWater = water.get() - leakedWater;
            // 可能水已漏光，设为0
            water.set(Math.max(0,leftWater));
            leakTimeStamp=System.currentTimeMillis();
        }
        log.info("剩余容量:{}",capacity-water.get());

        if (water.get() < capacity){
            log.info("tryAcquire success");
            water.incrementAndGet();
            return true;
        }else {
            log.info("tryAcquire fail");
            return false;
        }
    }
}
```

进行一下测试，先初始化一个漏桶，设置桶的容量为3，每秒放行1个请求，在代码中每500毫秒尝试请求1次：

```java
void test() throws InterruptedException {
    LeakyBucketRateLimiter leakyBucketRateLimiter
			=new LeakyBucketRateLimiter(3,1);
    for (int i = 0; i < 15; i++) {
        if (leakyBucketRateLimiter.tryAcquire()) {
            System.out.println("执行任务");
        }else {
            System.out.println("被限流");
        }
        TimeUnit.MILLISECONDS.sleep(500);
    }
}
```

查看运行结果，按规则进行了放行：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4c64935cb8eb438caa01c444523537f9~tplv-k3u1fbpfcp-zoom-1.image)

但是，漏桶算法同样也有缺点，不管当前系统的负载压力如何，所有请求都得进行排队，即使此时服务器的负载处于相对空闲的状态，这样会造成系统资源的浪费。由于漏桶的缺陷比较明显，所以在实际业务场景中，使用的比较少。

## 令牌桶算法

令牌桶算法是基于漏桶算法的一种改进，主要在于令牌桶算法能够在限制服务调用的平均速率的同时，还能够允许一定程度内的突发调用。

它的主要思想是系统以恒定的速度生成令牌，并将令牌放入令牌桶中，当令牌桶中满了的时候，再向其中放入的令牌就会被丢弃。而每次请求进入时，必须从令牌桶中获取一个令牌，如果没有获取到令牌则被限流拒绝。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bcc040485c174cbfa43e37102593362e~tplv-k3u1fbpfcp-zoom-1.image)

假设令牌的生成速度是每秒100个，并且第一秒内只使用了70个令牌，那么在第二秒可用的令牌数量就变成了130，在允许的请求范围上限内，扩大了请求的速率。当然，这里要设置桶容量的上限，避免超出系统能够承载的最大请求数量。

Guava中的`RateLimiter`就是基于令牌桶实现的，可以直接拿来使用，先引入依赖：

```xml
<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
    <version>29.0-jre</version>
</dependency>
```

进行测试，设置每秒产生5个令牌：

```java
void acquireTest(){
    RateLimiter rateLimiter=RateLimiter.create(5);
    for (int i = 0; i < 10; i++) {
        double time = rateLimiter.acquire();
        log.info("等待时间：{}s",time);
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bb71a60ad4a744719f95cff6209b95c7~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，每200ms左右产生一个令牌并放行请求，也就是1秒放行5个请求，使用`RateLimiter`能够很好的实现单机的限流。

那么再回到我们前面提到的突发流量情况，令牌桶是怎么解决的呢？`RateLimiter`中引入了一个**预消费**的概念。在源码中，有这么一段注释：

```java
 * <p>It is important to note that the number of permits requested <i>never</i> affects the
 * throttling of the request itself (an invocation to {@code acquire(1)} and an invocation to {@code
 * acquire(1000)} will result in exactly the same throttling, if any), but it affects the throttling
 * of the <i>next</i> request. I.e., if an expensive task arrives at an idle RateLimiter, it will be
 * granted immediately, but it is the <i>next</i> request that will experience extra throttling,
 * thus paying for the cost of the expensive task.
```

大意就是，申请令牌的**数量**不同不会影响这个申请令牌这个动作本身的响应时间，`acquire(1)`和`acquire(1000)`这两个请求会消耗同样的时间返回结果，但是会影响下一个请求的响应时间。

如果一个消耗大量令牌的任务到达**空闲**的`RateLimiter`，会被立即批准执行，但是当下一个请求进来时，将会额外等待一段时间，用来支付前一个请求的时间成本。

至于为什么要这么做，通过举例来引申一下。当一个系统处于空闲状态时，突然来了1个需要消耗100个令牌的任务，那么白白等待100秒是毫无意义的浪费资源行为，那么可以先允许它执行，并对后续请求进行限流时间上的延长，以此来达到一个应对突发流量的效果。

看一下具体的代码示例：

```java
void acquireMultiTest(){
    RateLimiter rateLimiter=RateLimiter.create(1);
    
    for (int i = 0; i <3; i++) {
        int num = 2 * i + 1;
        log.info("获取{}个令牌", num);
        double cost = rateLimiter.acquire(num);
        log.info("获取{}个令牌结束，耗时{}ms",num,cost);
    }
}
```

运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c966c933beda4cd2adc1b9da99e498c7~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，在第二次请求时需要3个令牌，但是并没有等3秒后才获取成功，而是在等第一次的1个令牌所需要的1秒偿还后，立即获得了3个令牌得到了放行。同样，第三次获取5个令牌时等待的3秒是偿还的第二次获取令牌的时间，偿还完成后立即获取5个新令牌，而并没有等待全部重新生成完成。

除此之外`RateLimiter`还具有平滑预热功能，下面的代码就实现了在启动3秒内，平滑提高令牌发放速率到每秒5个的功能：

```java
void acquireSmoothly(){
    RateLimiter rateLimiter=RateLimiter.create(5,3, TimeUnit.SECONDS);
    long startTimeStamp = System.currentTimeMillis();
    for (int i = 0; i < 15; i++) {
        double time = rateLimiter.acquire();
        log.info("等待时间:{}s, 总时间:{}ms"
                ,time,System.currentTimeMillis()-startTimeStamp);
    }
}
```

查看运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e403810032154f4cbf7e1bbd89084663~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，令牌发放时间从最开始的500ms多逐渐缩短，在3秒后达到了200ms左右的匀速发放。

总的来说，基于令牌桶实现的`RateLimiter`功能还是非常强大的，在限流的基础上还可以把请求平均分散在各个时间段内，因此在单机情况下它是使用比较广泛的限流组件。

## 中间件限流

前面讨论的四种方式都是针对单体架构，无法跨JVM进行限流，而在分布式、微服务架构下，可以借助一些中间件进行限。Sentinel是`Spring Cloud Alibaba`中常用的熔断限流组件，为我们提供了开箱即用的限流方法。

使用起来也非常简单，在service层的方法上添加`@SentinelResource`注解，通过`value`指定资源名称，`blockHandler`指定一个方法，该方法会在原方法被限流、降级、系统保护时被调用。

```java
@Service
public class QueryService {
    public static final String KEY="query";

    @SentinelResource(value = KEY,
            blockHandler ="blockHandlerMethod")
    public String query(String name){
        return "begin query,name="+name;
    }

    public String blockHandlerMethod(String name, BlockException e){
        e.printStackTrace();
        return "blockHandlerMethod for Query : " + name;
    }
}
```

配置限流规则，这里使用直接编码方式配置，指定QPS到达1时进行限流：

```java
@Component
public class SentinelConfig {
    @PostConstruct
    private void init(){
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule(QueryService.KEY);
        rule.setCount(1);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setLimitApp("default");
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }
}
```

在`application.yml`中配置sentinel的端口及dashboard地址：

```yml
spring:
  application:
    name: sentinel-test
  cloud:
    sentinel:
      transport:
        port: 8719
        dashboard: localhost:8088
```

启动项目后，启动`sentinel-dashboard`：

```shell
java -Dserver.port=8088 -jar sentinel-dashboard-1.8.0.jar
```

在浏览器打开dashboard就可以看见我们设置的流控规则：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1f87ce02e5cb487b896a6cfc26ffe827~tplv-k3u1fbpfcp-zoom-1.image)

进行接口测试，在超过QPS指定的限制后，则会执行`blockHandler()`方法中的逻辑：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/98453c2911594f5b98bd9b4b96efd236~tplv-k3u1fbpfcp-zoom-1.image)

Sentinel在微服务架构下得到了广泛的使用，能够提供可靠的集群流量控制、服务断路等功能。在使用中，限流可以结合熔断、降级一起使用，成为有效应对三高系统的三板斧，来保证服务的稳定性。

## 网关限流

网关限流也是目前比较流行的一种方式，这里我们介绍采用Spring Cloud的`gateway`组件进行限流的方式。

在项目中引入依赖，gateway的限流实际使用的是Redis加lua脚本的方式实现的令牌桶，因此还需要引入redis的相关依赖：

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

对gateway进行配置，主要就是配一下令牌的生成速率、令牌桶的存储量上限，以及用于限流的键的解析器。这里设置的桶上限为2，每秒填充1个令牌：

```yml
spring:
  application:
    name: gateway-test
  cloud:
    gateway:
      routes:
        - id: limit_route
          uri: lb://sentinel-test
          predicates:
          - Path=/sentinel-test/**
          filters:
            - name: RequestRateLimiter
              args:
                # 令牌桶每秒填充平均速率
                redis-rate-limiter.replenishRate: 1
                # 令牌桶上限
                redis-rate-limiter.burstCapacity: 2
                # 指定解析器，使用spEl表达式按beanName从spring容器中获取
                key-resolver: "#{@pathKeyResolver}"
            - StripPrefix=1
  redis:
    host: 127.0.0.1
    port: 6379
```

我们使用请求的路径作为限流的键，编写对应的解析器：

```java
@Slf4j
@Component
public class PathKeyResolver implements KeyResolver {
    public Mono<String> resolve(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().toString();
        log.info("Request path: {}",path);
        return Mono.just(path);
    }
}
```

启动gateway，使用jmeter进行测试，设置请求间隔为500ms，因为每秒生成一个令牌，所以后期达到了每两个请求放行1个的限流效果，在被限流的情况下，http请求会返回429状态码。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c4492de36514476d91474eae7044c1bb~tplv-k3u1fbpfcp-zoom-1.image)

除了上面的根据请求路径限流外，我们还可以灵活设置各种限流的维度，例如根据请求header中携带的用户信息、或是携带的参数等等。当然，如果不想用gateway自带的这个Redis的限流器的话，我们也可以自己实现`RateLimiter`接口来实现一个自己的限流工具。

gateway实现限流的关键是`spring-cloud-gateway-core`包中的`RedisRateLimiter`类，以及`META-INF/scripts`中的`request-rate-limiter.lua`这个脚本，如果有兴趣可以看一下具体是如何实现的。

## 总结

总的来说，要保证系统的抗压能力，限流是一个必不可少的环节，虽然可能会造成某些用户的请求被丢弃，但相比于突发流量造成的系统宕机来说，这些损失一般都在可以接受的范围之内。前面也说过，限流可以结合熔断、降级一起使用，多管齐下，保证服务的可用性与健壮性。

那么，这次的分享就到这里，我是Hydra，我们下篇再见。

>  文中的全部测试代码都传到了我的github，有需要可以自行领取：
>  https://github.com/trunks2008/rate-limiter  
>  码字不易~ 欢迎大家给Hydra点个Star啊，谢谢~


