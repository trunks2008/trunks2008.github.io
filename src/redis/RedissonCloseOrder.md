---
title: 使用Redisson优雅关闭订单
icon: page
order: 8
author: Hydra
date: 2020-11-15
tag:
  - Redis
  - Redisson
star: true
---



<!-- more -->

在支付系统中，订单通常是具有时效性的，例如在下单30分钟后如果还没有完成支付，那么就要取消订单，不能再执行后续流程。说到这，可能大家的第一反应是启动一个定时任务，来轮询订单的状态是否完成了支付，如果超时还没有完成，那么就去修改订单的关闭字段。当然，在数据量小的时候这么干没什么问题，但是如果订单的数量上来了，那么就会出现读取数据的瓶颈，毕竟来一次全表扫描还是挺费时的。


针对于定时任务的这种缺陷，关闭订单的这个需求大多依赖于延时任务来实现，这里说明一下延时任务与定时任务的最大不同，定时任务有执行周期的，而延时任务在某事件触发后一段时间内执行，并没有执行周期。


对于延时任务，可能大家对于`RabbitMQ`的延时队列会比较熟悉，用起来也是得心应手，但是你是否知道使用Redis也能实现延时任务的功能呢，今天我们就来看看具体应该如何实现。



使用Redis实现的延时队列，需要借助Redisson的依赖：
```java
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.10.7</version>
</dependency>
```

首先实现往延时队列中添加任务的方法，为了测试时方便，我们把延迟时间设为30秒。
```java
@Component
public class UnpaidOrderQueue {
    @Autowired
    RedissonClient redissonClient;

    public void addUnpaid(String orderId){
        RBlockingQueue<String> blockingFairQueue = redissonClient.getBlockingQueue("orderQueue");
        RDelayedQueue<String> delayedQueue = redissonClient.getDelayedQueue(blockingFairQueue);

        System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+" 添加任务到延时队列");
        delayedQueue.offer(orderId,30, TimeUnit.SECONDS);
    }
}
```

添加一个对队列的监听方法，通过实现`CommandLineRunner`接口，使它在`springboot`启动时就开始执行：
```java
@Component
public class QueueRunner implements CommandLineRunner {
    @Autowired
    private RedissonClient redissonClient;

    @Autowired
    private OrderService orderService;

    @Override
    public void run(String... args) throws Exception {
        new Thread(()->{
            RBlockingQueue<String> blockingFairQueue = redissonClient.getBlockingQueue("orderQueue");
            RDelayedQueue<String> delayedQueue = redissonClient.getDelayedQueue(blockingFairQueue);
            delayedQueue.offer(null, 1, TimeUnit.SECONDS);
            while (true){
                String orderId = null;
                try {
                    orderId = blockingFairQueue.take();
                } catch (Exception e) {
                    continue;
                }
                if (orderId==null) {
                    continue;
                }
                System.out.println(String.format(DateTime.now().toString(JodaUtil.HH_MM_SS)+" 延时队列收到："+orderId));
                System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+" 检测订单是否完成支付");
                if (orderService.isTimeOut(orderId)) {
                    orderService.closeOrder(orderId);
                }
            }
        }).start();
    }
}
```
在方法中，单独启动了一个线程来进行监听，如果有任务进入延时队列，那么取到订单号后，调用我们`OrderService`提供的检测是否订单过期的服务，如果过期，那么执行关闭订单的操作。



创建简单的`OrderService`用于测试，提供创建订单，检测超时，关闭订单方法：
```java
@Service
public class OrderService {

    @Autowired
    UnpaidOrderQueue unpaidOrderQueue;

    public void createOrder(String order){
        System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+" 创建订单:"+order);
        unpaidOrderQueue.addUnpaid(order);
    }

    public boolean isTimeOut(String orderId){
        return true;
    }

    public void closeOrder(String orderId){
        System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+ " 关闭订单");
    }
}
```
执行请求，看一下结果：


![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea9fa08afeb64198a8d268e1875b8e88~tplv-k3u1fbpfcp-zoom-1.image)



在订单创建30秒后，检测到延时队列中有任务任务，调用检测超时方法检测到订单没有完成后，自动关闭订单。



除了上面这种延时队列的方式外，`Redisson`还提供了另一种方式，也能优雅的关闭订单，方法很简单，就是通过对将要过期的key值的监听。



创建一个类继承`KeyExpirationEventMessageListener`，重写其中的`onMessage`方法，就能实现对过期key的监听，一旦有缓存过期，就会调用其中的`onMessage`方法：
```java
@Component
public class RedisExpiredListener extends KeyExpirationEventMessageListener {
    public static final String UNPAID_PREFIX="unpaidOrder:";

    @Autowired
    OrderService orderService;

    public RedisExpiredListener(RedisMessageListenerContainer listenerContainer) {
        super(listenerContainer);
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();
        if (expiredKey.startsWith(UNPAID_PREFIX)){
            System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+" " +expiredKey+"已过期");
            orderService.closeOrder(expiredKey);
        }
    }
}
```
因为可能会有很多key的过期事件，因此需要对订单过期的key加上一个前缀，用来判断过期的key是不是属于订单事件，如果是的话那么进行关闭订单操作。



再在写一个测试接口，用于创建订单和接收支付成功的回调结果：
```java
@RestController
@RequestMapping("order")
public class TestController {
    @Autowired
    RedisTemplate redisTemplate;

    @GetMapping("create")
    public String setTemp(String id){
        String orderId= RedisExpiredListener.UNPAID_PREFIX+id;
        System.out.println(DateTime.now().toString(JodaUtil.HH_MM_SS)+" 创建订单:"+orderId);
        redisTemplate.opsForValue().set(orderId,orderId,30, TimeUnit.SECONDS);
        return id;
    }

    @GetMapping("fallback")
    public void successFallback(String id){
        String orderId= RedisExpiredListener.UNPAID_PREFIX+id;
        redisTemplate.delete(orderId);
    }
}
```
在订单支付成功后，一般我们会收到第三方的一个支付成功的异步回调通知。如果支付完成后收到了这个回调，那么我们主动删除缓存的未支付订单，那么也就不会监听到这个订单的`orderId`的过期失效事件。



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/74bd7f6697c44bd7ab6f676a2ccbdc1a~tplv-k3u1fbpfcp-zoom-1.image)



但是这种方式有一个弊端，就是只能监听到过期缓存的key，不能获取到对应的value。而通过延时队列的方式，可以通过为`RBlockingQueue`添加泛型的方式，保存更多订单的信息，例如直接将对象存进队列中：
```java
RBlockingQueue<OrderDTO> blockingFairQueue = redissonClient.getBlockingQueue("orderQueue");
RDelayedQueue<OrderDTO> delayedQueue = redissonClient.getDelayedQueue(blockingFairQueue);
```

这样的话我们再从延时队列中获取的时候，能够拿到更多我们需要的属性。综合以上两种方式，监听过期更为简单，但存在的一定的局限性，如果我们只需要对订单进行判断的话那么功能也能够满足我们的需求，如果需要在过期时获取更多的订单属性，那么使用延时队列的方式则更为合适。究竟选择哪种，就要看大家的业务场景了。