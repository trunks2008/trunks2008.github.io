---
title: 仿照Hystrix，手写一个限流组件
icon: page
order: 9
author: Hydra
date: 2020-11-08
tag:
  - Hystrix
  - 限流
star: true
---



<!-- more -->

这周工作的时候，碰见了这样一个问题，在我们的业务系统中，当用户访问自己的订单列表时，如果订单已经被添加了物流单号，但是后台还没有刷新到它的物流状态时，会去调用第三方物流的接口来刷新自己的物流状态。在这个过程中发现，一旦访问频率太过频繁的话就会被第三方限制，在一段时间内所有再发过去的请求都会被ban掉。

当一旦出现限流的情况，那么所有用户的物流状态都将无法被查询及刷新，将会给用户带来很不好的用户体验。所以我们的业务系统就需要实现这样的功能：

- 用户第一次访问自己的订单列表时，直接调用第三方物流接口获取一次状态
- 在接下来的一段时间，在访问订单列表时，不调用第三方接口刷新状态。做出此判断的依据是，对于用户来说，订单列表的访问功能是必须的，但是物流状态可能并非是刚需，因此此段时间绕过调用第三方接口
- 当用户在一段时间内，访问频率到达一定量时，例如在60秒内访问了5次，那么判断用户获取物流状态的需求非常急迫，放行一次调用第三方接口，之后再次恢复之前的规则

对以上需求进行了一下评估后，发现无论是`Hystrix`和`Sentinel`的限流规则，还是网关的漏桶和令牌桶，对我们来说都不是很适用，因此决定自己写一个组件，来实现这个限流规则。我们知道，Hystrix是基于时间窗口内的失败统计，以及线程池或信号量隔离实现的快速失败机制，那么我们就仿照这个模式来实现自己的限流功能。

先从最基础的功能部分开始实现，实现一个滑动时间窗口，来统计一段时间内接口的调用次数：

```java
@Slf4j
public class MethodAccessWindow {
    @AllArgsConstructor
    @Data
    class Node{
        long time;
    }

    Queue<Node> queue;
    ScheduledExecutorService scheduledExecutorService;

    private int windowTime;
    private int size;

    public MethodAccessWindow(int windowTime, int size){
        queue=new ArrayBlockingQueue<>(size);
        this.windowTime = windowTime;
        this.size=size;
        init();
    }

    private void init(){
        System.out.println("初始化定时任务");
        scheduledExecutorService = Executors.newScheduledThreadPool(5);
        scheduledExecutorService.scheduleWithFixedDelay(()->{
            clean();
        },windowTime*1000,1000, TimeUnit.MILLISECONDS);
    }

    public boolean canReceive(){
        if(queue.size()>=size){
            return false;
        }else {
            queue.add(new Node(System.currentTimeMillis()));
            return true;
        }
    }

    public void clean(){
        for (Node node:queue){
            if (System.currentTimeMillis()-node.getTime()> (windowTime *1000)){
                queue.poll();
            }
        }
    }

    public void reset(){
        queue.clear();
    }

    public void destroy(){
        log.info("destroy");
        try {
            scheduledExecutorService.shutdown();
            if (!scheduledExecutorService.awaitTermination(60, TimeUnit.SECONDS)) {
                scheduledExecutorService.shutdownNow();
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("awaitTermination interrupted: " + e);
            scheduledExecutorService.shutdownNow();
        }
        log.info("end destroy");
    }
}
```

在上面的类中：

- `windowTime`表示滑动窗口的时间长度，`size`表示能够接受的任务数，使用队列来接收任务，队列长度为`size`
- 在构造函数中启动线程池执行一个定时任务，会遍历队列中的节点，当节点的存活时间大于窗口时间时，删除过期节点。如果对实时要求比较高，可以修改定时任务的执行间隔
- `canReceive`方法用于接收任务，当队列长度已满时，返回false
- `reset`方法用于清空队列，即重置窗口值

进行测试，设置为20秒的时间窗口可以接受5次请求：

```java
public class Test {
    public static void main(String[] args) throws InterruptedException {
        MethodAccessWindow methodAccessWindow =new MethodAccessWindow(20,5);
        for (int i = 0; i < 30; i++) {
            System.out.println(i+"  "+ methodAccessWindow.canReceive());
            TimeUnit.SECONDS.sleep(1);
        }
        methodAccessWindow.destroy();
    }
}
```

在队列满后拒绝请求：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7b80dfea616e41179dc99009e5e2946c~tplv-k3u1fbpfcp-zoom-1.image)

当到达第20秒时，前19个时间窗口内只有4个任务存在，因此可以接受任务，之后4秒同理：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ddf424812d464ae9babea70c48289d17~tplv-k3u1fbpfcp-zoom-1.image)

完成了时间窗口，我们要把它应用在需要被限流的方法上，因此仿照`Hystrix`的格式，定义一个注解：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface NeedPassLimit {
    int timeWindow() default 100;
    int frequency() default 10;
    String fallBackMethod() default "";
}
```

按照之前的规则，在`timeWindow`的时间窗口，当访问次数超过`frequency`时，进行一次放行，否则执行`fallBackMethod`指定的降级方法。将注解写在`Service`的方法上：

```java
@Service
@Slf4j
public class MyService {

    @NeedPassLimit(timeWindow = 20, frequency = 5, fallBackMethod = "fallback")
    public String getInfo(Long userId){
        log.info("放行："+userId.toString());
        return "success";
    }

    public String fallback(Long userId){
        log.info("拦截："+userId.toString());
        return "restriction";
    }
}
```

这里在方法中，传入了一个`userId`字段，用以表明是哪个用户调用的方法。这是因为，按照仓壁模式，需要对用户以及访问的方法创建滑动窗口的隔离，这里简单使用类名加方法名加`userId`的方式，来区分不用的滑动窗口实例。给`MethodAccessWindow`添加一个字段`windowKey`，并修改构造方法：

```java
private String windowKey;
public MethodAccessWindow(int windowTime, int size, String windowKey){
    queue=new ArrayBlockingQueue<>(size);
    this.windowTime = windowTime;
    this.size=size;
    this.windowKey = windowKey;
    init();
}
```

接下来，实现重要的切面方法：

```java
@Component
@Aspect
public class MethodPassAspect {

    //缓存各个用户的 Window
    @Getter
    private ConcurrentHashMap<String, MethodAccessWindow> passerMap =new ConcurrentHashMap<>();

    @Pointcut("@annotation(com.cn.hydra.aspectdemo.rule.annotation.NeedPassLimit)")
    public void freshPointCut() {
    }

    @Around("freshPointCut()")
    public Object doAround(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();

        if (method.isAnnotationPresent(NeedPassLimit.class)) {
            Object[] args = point.getArgs();
            String[] parameterNames = signature.getParameterNames();
            List<String> paramNameList = Arrays.asList(parameterNames);

            String passerKey=null;
            if (paramNameList.contains("userId")) {
                passerKey=point.getTarget().getClass().getName()
                        +"#"+method.getName()+"#"+args[paramNameList.indexOf("userId")];
            }

            NeedPassLimit annotation = method.getAnnotation(NeedPassLimit.class);
            int timeWindow = annotation.timeWindow();
            int frequency = annotation.frequency();
            String fallBackMethodName = annotation.fallBackMethod();

            MethodAccessWindow methodAccessWindow;
            if (passerMap.keySet().contains(passerKey)) {
                methodAccessWindow = passerMap.get(passerKey);
            }else {
                //第一次，放过请求
                methodAccessWindow= new MethodAccessWindow(timeWindow,frequency,passerKey);
                passerMap.put(passerKey,methodAccessWindow);

                Object object = point.proceed();
                return object;
            }

            if (methodAccessWindow.canReceive()){
                Object fallbackObject = invokeFallbackMethod(method, point.getTarget(), fallBackMethodName, args);
                return fallbackObject;
            }else{
                Object object = point.proceed();
                methodAccessWindow.reset();
                return object;
            }
        }
        return null;
    }

    private Object invokeFallbackMethod(Method method, Object bean, String fallbackMethodName, Object[] arguments) throws Exception {
        Class beanClass = bean.getClass();
        Method fallbackMethod = beanClass.getMethod(fallbackMethodName, method.getParameterTypes());
        Object fallbackObject = fallbackMethod.invoke(bean, arguments);
        return fallbackObject;
    }
}
```

在上面方法中：

- `passerMap` 缓存了各个用户访问的接口的滑动窗口，用以实现仓壁模式
- 当用户第一次访问时，执行原请求方法，执行后创建滑动窗口，放进`passerMap` 中缓存
- 当用户之后访问时，调用`canReceive`方法，如果返回为true，执行降级方法
- 当`canReceive`返回为false时，执行原方法，并重置滑动窗口

在实现了上面的主要功能后，需要注意滑动窗口是一直存在的，为了保护系统资源，我们有必要销毁不需要的滑动窗口。主要需要实现将滑动窗口对象实例从切面的passerMap 中移除，之后交给jvm垃圾回收器进行回收即可。

实现方式也很简单，当我们判断该滑动窗口已经很久没有使用时，发送一个自定义事件给我们自定义的spring事件监听器，由监听器负责移除该滑动窗口实例。先定义窗口关闭事件：

```java
public class WindowCloseEvent extends ApplicationEvent {
    @Getter
    private String windowKey;

    public WindowCloseEvent(Object source, String windowKey) {
        super(source);
        this.windowKey = windowKey;
    }
}
```

然后定义事件监听器，监听上面的`WindowCloseEvent`事件：

```java
@Component
@Slf4j
public class WindowCloseEventListener implements ApplicationListener<WindowCloseEvent> {
    @Autowired
    MethodPassAspect methodPassAspect;

    @Override
    public void onApplicationEvent(WindowCloseEvent windowCloseEvent) {
        log.info("close:"+windowCloseEvent.getWindowKey());
        ConcurrentHashMap<String, MethodAccessWindow> passerMap = methodPassAspect.getPasserMap();
        System.out.println(passerMap.toString());
        passerMap.remove(windowCloseEvent.getWindowKey());
        System.out.println(passerMap.toString());
    }
}
```

再定义一个事件发布方法的`EventPublisher`，用来发送事件：

```java
@Component
public class EventPublisher {
    @Autowired
    private ApplicationEventPublisher applicationEventPublisher;

    public void publish(ApplicationEvent applicationEvent){
        applicationEventPublisher.publishEvent(applicationEvent);
    }
}
```

那么，究竟该在什么时机去发送这个事件呢？我们可以在滑动窗口中记录一下最后使用时间，当超过约定的最大未使用时间时，将其从切面的`passerMap`中移除。在滑动窗口类中添加两个变量，修改构造方法，初始化这两个变量：

```java
private long lastCallTime;//最后调用时间
private long shutDownTime;//最长未调用时间

public MethodAccessWindow(int windowTime, int size, String windowKey){
    queue=new ArrayBlockingQueue<>(size);
    this.windowTime = windowTime;
    this.size=size;
    this.windowKey = windowKey;
    lastCallTime=System.currentTimeMillis();
    shutDownTime =windowTime*1000*3;//可自由进行长短额定义
    init();
}
```

在每次调用方法时，先刷新`lastCallTime`：

```java
public boolean canReceive(){
  this.lastCallTime=System.currentTimeMillis();
  ......
}
```

回头看一下，滑动窗口实例对象在后台存在一个定时任务，用于清除超过时间窗口的任务，那么可以在这后面可以再添加一个任务，用于判断当前时间减去最后调用时间，是否超过定义个最长不使用时间。但是有一个问题，`MethodAccessWindow`并不是一个注册到spring环境的`Bean`，不能使用自动注入来注入`EventPublisher`对象，这里可以通过静态方法来获取**spring容器**，之后再使用容器的`getBean`方法拿到`EventPublisher`的对象。添加事件发布对象及其set方法：

```java
private static EventPublisher eventPublisher;
public static void setEventPubisher(ApplicationContext applicationContext ){
    eventPublisher=applicationContext.getBean(EventPublisher.class);
}
```

在`spring`容器完成初始化后，从启动类直接给滑动窗口注入：

```java
@SpringBootApplication
public class AspectdemoApplication {
    public static void main(String[] args) {
        ApplicationContext applicationContext = SpringApplication.run(AspectdemoApplication.class, args);
        MethodAccessWindow.setEventPubisher(applicationContext);
    }
}
```

修改定时任务，在定时任务中发送关闭滑动窗口事件，并发送关闭线程池请求：

```java
public void clean(){     
    for (Node node:queue){
        if (System.currentTimeMillis()-node.getTime()> (windowTime *1000)){
            queue.poll();
        }
    }

    //超过时间不用则自动销毁
    if (System.currentTimeMillis()-lastCallTime >= shutDownTime){
        log.info("发送event");
        WindowCloseEvent windowCloseEvent=new WindowCloseEvent(this, windowKey);
        eventPublisher.publish(windowCloseEvent);
        log.info("发送event end");

        destroy();
    }
}
```

调用`Service`接口进行测试：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9453802b03d2429aac39ec8fea4ef10b~tplv-k3u1fbpfcp-zoom-1.image)

在滑动窗口时间20秒，最大空闲时间设置为窗口事件3倍的情况下，在最后一次请求调用的后1分钟，发送了窗口关闭事件并被监听，从`passerMap`中移除，并且在之后销毁了线程池。这样，一个能够自定义规则的限流组件就完成了。