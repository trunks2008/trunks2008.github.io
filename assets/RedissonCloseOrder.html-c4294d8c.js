import{_ as n,W as s,X as a,$ as t,Z as p}from"./framework-9e67db09.js";const e={},o=p(`<p>在支付系统中，订单通常是具有时效性的，例如在下单30分钟后如果还没有完成支付，那么就要取消订单，不能再执行后续流程。说到这，可能大家的第一反应是启动一个定时任务，来轮询订单的状态是否完成了支付，如果超时还没有完成，那么就去修改订单的关闭字段。当然，在数据量小的时候这么干没什么问题，但是如果订单的数量上来了，那么就会出现读取数据的瓶颈，毕竟来一次全表扫描还是挺费时的。</p><p>针对于定时任务的这种缺陷，关闭订单的这个需求大多依赖于延时任务来实现，这里说明一下延时任务与定时任务的最大不同，定时任务有执行周期的，而延时任务在某事件触发后一段时间内执行，并没有执行周期。</p><p>对于延时任务，可能大家对于<code>RabbitMQ</code>的延时队列会比较熟悉，用起来也是得心应手，但是你是否知道使用Redis也能实现延时任务的功能呢，今天我们就来看看具体应该如何实现。</p><p>使用Redis实现的延时队列，需要借助Redisson的依赖：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token generics"><span class="token punctuation">&lt;</span>dependency<span class="token punctuation">&gt;</span></span>
    <span class="token generics"><span class="token punctuation">&lt;</span>groupId<span class="token punctuation">&gt;</span></span>org<span class="token punctuation">.</span>redisson<span class="token operator">&lt;</span><span class="token operator">/</span>groupId<span class="token operator">&gt;</span>
    <span class="token generics"><span class="token punctuation">&lt;</span>artifactId<span class="token punctuation">&gt;</span></span>redisson<span class="token operator">-</span>spring<span class="token operator">-</span>boot<span class="token operator">-</span>starter<span class="token operator">&lt;</span><span class="token operator">/</span>artifactId<span class="token operator">&gt;</span>
    <span class="token generics"><span class="token punctuation">&lt;</span>version<span class="token punctuation">&gt;</span></span><span class="token number">3.10</span><span class="token number">.7</span><span class="token operator">&lt;</span><span class="token operator">/</span>version<span class="token operator">&gt;</span>
<span class="token operator">&lt;</span><span class="token operator">/</span>dependency<span class="token operator">&gt;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>首先实现往延时队列中添加任务的方法，为了测试时方便，我们把延迟时间设为30秒。</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Component</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">UnpaidOrderQueue</span> <span class="token punctuation">{</span>
    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">RedissonClient</span> redissonClient<span class="token punctuation">;</span>

    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">addUnpaid</span><span class="token punctuation">(</span><span class="token class-name">String</span> orderId<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">RBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> blockingFairQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getBlockingQueue</span><span class="token punctuation">(</span><span class="token string">&quot;orderQueue&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token class-name">RDelayedQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> delayedQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getDelayedQueue</span><span class="token punctuation">(</span>blockingFairQueue<span class="token punctuation">)</span><span class="token punctuation">;</span>

        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; 添加任务到延时队列&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        delayedQueue<span class="token punctuation">.</span><span class="token function">offer</span><span class="token punctuation">(</span>orderId<span class="token punctuation">,</span><span class="token number">30</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>添加一个对队列的监听方法，通过实现<code>CommandLineRunner</code>接口，使它在<code>springboot</code>启动时就开始执行：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Component</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">QueueRunner</span> <span class="token keyword">implements</span> <span class="token class-name">CommandLineRunner</span> <span class="token punctuation">{</span>
    <span class="token annotation punctuation">@Autowired</span>
    <span class="token keyword">private</span> <span class="token class-name">RedissonClient</span> redissonClient<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token keyword">private</span> <span class="token class-name">OrderService</span> orderService<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Override</span>
    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">run</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span> args<span class="token punctuation">)</span> <span class="token keyword">throws</span> <span class="token class-name">Exception</span> <span class="token punctuation">{</span>
        <span class="token keyword">new</span> <span class="token class-name">Thread</span><span class="token punctuation">(</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">-&gt;</span><span class="token punctuation">{</span>
            <span class="token class-name">RBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> blockingFairQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getBlockingQueue</span><span class="token punctuation">(</span><span class="token string">&quot;orderQueue&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token class-name">RDelayedQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> delayedQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getDelayedQueue</span><span class="token punctuation">(</span>blockingFairQueue<span class="token punctuation">)</span><span class="token punctuation">;</span>
            delayedQueue<span class="token punctuation">.</span><span class="token function">offer</span><span class="token punctuation">(</span><span class="token keyword">null</span><span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">while</span> <span class="token punctuation">(</span><span class="token boolean">true</span><span class="token punctuation">)</span><span class="token punctuation">{</span>
                <span class="token class-name">String</span> orderId <span class="token operator">=</span> <span class="token keyword">null</span><span class="token punctuation">;</span>
                <span class="token keyword">try</span> <span class="token punctuation">{</span>
                    orderId <span class="token operator">=</span> blockingFairQueue<span class="token punctuation">.</span><span class="token function">take</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span><span class="token class-name">Exception</span> e<span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token keyword">continue</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span>orderId<span class="token operator">==</span><span class="token keyword">null</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    <span class="token keyword">continue</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
                <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">.</span><span class="token function">format</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; 延时队列收到：&quot;</span><span class="token operator">+</span>orderId<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; 检测订单是否完成支付&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token keyword">if</span> <span class="token punctuation">(</span>orderService<span class="token punctuation">.</span><span class="token function">isTimeOut</span><span class="token punctuation">(</span>orderId<span class="token punctuation">)</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
                    orderService<span class="token punctuation">.</span><span class="token function">closeOrder</span><span class="token punctuation">(</span>orderId<span class="token punctuation">)</span><span class="token punctuation">;</span>
                <span class="token punctuation">}</span>
            <span class="token punctuation">}</span>
        <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">start</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在方法中，单独启动了一个线程来进行监听，如果有任务进入延时队列，那么取到订单号后，调用我们<code>OrderService</code>提供的检测是否订单过期的服务，如果过期，那么执行关闭订单的操作。</p><p>创建简单的<code>OrderService</code>用于测试，提供创建订单，检测超时，关闭订单方法：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Service</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">OrderService</span> <span class="token punctuation">{</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">UnpaidOrderQueue</span> unpaidOrderQueue<span class="token punctuation">;</span>

    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">createOrder</span><span class="token punctuation">(</span><span class="token class-name">String</span> order<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; 创建订单:&quot;</span><span class="token operator">+</span>order<span class="token punctuation">)</span><span class="token punctuation">;</span>
        unpaidOrderQueue<span class="token punctuation">.</span><span class="token function">addUnpaid</span><span class="token punctuation">(</span>order<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">public</span> <span class="token keyword">boolean</span> <span class="token function">isTimeOut</span><span class="token punctuation">(</span><span class="token class-name">String</span> orderId<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token keyword">return</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">closeOrder</span><span class="token punctuation">(</span><span class="token class-name">String</span> orderId<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span> <span class="token string">&quot; 关闭订单&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>执行请求，看一下结果：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea9fa08afeb64198a8d268e1875b8e88~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在订单创建30秒后，检测到延时队列中有任务任务，调用检测超时方法检测到订单没有完成后，自动关闭订单。</p><p>除了上面这种延时队列的方式外，<code>Redisson</code>还提供了另一种方式，也能优雅的关闭订单，方法很简单，就是通过对将要过期的key值的监听。</p><p>创建一个类继承<code>KeyExpirationEventMessageListener</code>，重写其中的<code>onMessage</code>方法，就能实现对过期key的监听，一旦有缓存过期，就会调用其中的<code>onMessage</code>方法：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Component</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">RedisExpiredListener</span> <span class="token keyword">extends</span> <span class="token class-name">KeyExpirationEventMessageListener</span> <span class="token punctuation">{</span>
    <span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">final</span> <span class="token class-name">String</span> <span class="token constant">UNPAID_PREFIX</span><span class="token operator">=</span><span class="token string">&quot;unpaidOrder:&quot;</span><span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">OrderService</span> orderService<span class="token punctuation">;</span>

    <span class="token keyword">public</span> <span class="token class-name">RedisExpiredListener</span><span class="token punctuation">(</span><span class="token class-name">RedisMessageListenerContainer</span> listenerContainer<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">super</span><span class="token punctuation">(</span>listenerContainer<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@Override</span>
    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">onMessage</span><span class="token punctuation">(</span><span class="token class-name">Message</span> message<span class="token punctuation">,</span> <span class="token keyword">byte</span><span class="token punctuation">[</span><span class="token punctuation">]</span> pattern<span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token class-name">String</span> expiredKey <span class="token operator">=</span> message<span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">if</span> <span class="token punctuation">(</span>expiredKey<span class="token punctuation">.</span><span class="token function">startsWith</span><span class="token punctuation">(</span><span class="token constant">UNPAID_PREFIX</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">{</span>
            <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; &quot;</span> <span class="token operator">+</span>expiredKey<span class="token operator">+</span><span class="token string">&quot;已过期&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            orderService<span class="token punctuation">.</span><span class="token function">closeOrder</span><span class="token punctuation">(</span>expiredKey<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>因为可能会有很多key的过期事件，因此需要对订单过期的key加上一个前缀，用来判断过期的key是不是属于订单事件，如果是的话那么进行关闭订单操作。</p><p>再在写一个测试接口，用于创建订单和接收支付成功的回调结果：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@RestController</span>
<span class="token annotation punctuation">@RequestMapping</span><span class="token punctuation">(</span><span class="token string">&quot;order&quot;</span><span class="token punctuation">)</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">TestController</span> <span class="token punctuation">{</span>
    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">RedisTemplate</span> redisTemplate<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">&quot;create&quot;</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">String</span> <span class="token function">setTemp</span><span class="token punctuation">(</span><span class="token class-name">String</span> id<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">String</span> orderId<span class="token operator">=</span> <span class="token class-name">RedisExpiredListener</span><span class="token punctuation">.</span><span class="token constant">UNPAID_PREFIX</span><span class="token operator">+</span>id<span class="token punctuation">;</span>
        <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span><span class="token class-name">DateTime</span><span class="token punctuation">.</span><span class="token function">now</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">toString</span><span class="token punctuation">(</span><span class="token class-name">JodaUtil</span><span class="token punctuation">.</span><span class="token constant">HH_MM_SS</span><span class="token punctuation">)</span><span class="token operator">+</span><span class="token string">&quot; 创建订单:&quot;</span><span class="token operator">+</span>orderId<span class="token punctuation">)</span><span class="token punctuation">;</span>
        redisTemplate<span class="token punctuation">.</span><span class="token function">opsForValue</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">set</span><span class="token punctuation">(</span>orderId<span class="token punctuation">,</span>orderId<span class="token punctuation">,</span><span class="token number">30</span><span class="token punctuation">,</span> <span class="token class-name">TimeUnit</span><span class="token punctuation">.</span><span class="token constant">SECONDS</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">return</span> id<span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">&quot;fallback&quot;</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">successFallback</span><span class="token punctuation">(</span><span class="token class-name">String</span> id<span class="token punctuation">)</span><span class="token punctuation">{</span>
        <span class="token class-name">String</span> orderId<span class="token operator">=</span> <span class="token class-name">RedisExpiredListener</span><span class="token punctuation">.</span><span class="token constant">UNPAID_PREFIX</span><span class="token operator">+</span>id<span class="token punctuation">;</span>
        redisTemplate<span class="token punctuation">.</span><span class="token function">delete</span><span class="token punctuation">(</span>orderId<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在订单支付成功后，一般我们会收到第三方的一个支付成功的异步回调通知。如果支付完成后收到了这个回调，那么我们主动删除缓存的未支付订单，那么也就不会监听到这个订单的<code>orderId</code>的过期失效事件。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/74bd7f6697c44bd7ab6f676a2ccbdc1a~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>但是这种方式有一个弊端，就是只能监听到过期缓存的key，不能获取到对应的value。而通过延时队列的方式，可以通过为<code>RBlockingQueue</code>添加泛型的方式，保存更多订单的信息，例如直接将对象存进队列中：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">RBlockingQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">OrderDTO</span><span class="token punctuation">&gt;</span></span> blockingFairQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getBlockingQueue</span><span class="token punctuation">(</span><span class="token string">&quot;orderQueue&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token class-name">RDelayedQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">OrderDTO</span><span class="token punctuation">&gt;</span></span> delayedQueue <span class="token operator">=</span> redissonClient<span class="token punctuation">.</span><span class="token function">getDelayedQueue</span><span class="token punctuation">(</span>blockingFairQueue<span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>这样的话我们再从延时队列中获取的时候，能够拿到更多我们需要的属性。综合以上两种方式，监听过期更为简单，但存在的一定的局限性，如果我们只需要对订单进行判断的话那么功能也能够满足我们的需求，如果需要在过期时获取更多的订单属性，那么使用延时队列的方式则更为合适。究竟选择哪种，就要看大家的业务场景了。</p>`,26);function c(l,i){return s(),a("div",null,[t(" more "),o])}const k=n(e,[["render",c],["__file","RedissonCloseOrder.html.vue"]]);export{k as default};
