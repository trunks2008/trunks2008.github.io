import{_ as t,W as p,X as i,$ as c,Y as e,a0 as a,a1 as o,Z as n,C as l}from"./framework-9e67db09.js";const r={},d=n(`<p>Eureka作为Spring Cloud的核心模块之一，担任着服务注册发现等重要作用。如果梳理一下Eureka实际的工作流程，大体可以将它分为以下几个部分：</p><ul><li>服务注册</li><li>服务续约</li><li>服务剔除</li><li>服务下线</li><li>服务发现</li><li>集群信息同步</li></ul><p>上述各个方面，基于服务的运行场景不同，可能分别从Eureka的服务端（注册中心）与客户端（包含服务提供者与服务调用者）进行分析，为了简便下文中将Eureka服务端称为Eureka-server，客户端称为Eureka-client。本文先来说说基础的服务注册。</p><h2 id="服务注册" tabindex="-1"><a class="header-anchor" href="#服务注册" aria-hidden="true">#</a> 服务注册</h2><h3 id="eureka-client" tabindex="-1"><a class="header-anchor" href="#eureka-client" aria-hidden="true">#</a> Eureka-client</h3><p>在Eureka-client中，DiscoveryClient这个类用来和Eureka-server互相协作，看一下它的注释，它可以完成服务注册，服务续约，服务下线，获取服务列表等工作，可以说它完成了client的大多数功能。首先，看一下用来向eureka-server发起注册请求的<code>register</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bef24ee0178847d3b9e756887c7e2c0c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>调用 <code>AbstractJerseyEurekaHttpClient</code> 类的<code>register</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fb02bc7e8ae6483da59486cbd1b4120a~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>Jersey是一个Restful请求服务的框架，与常用的springmvc类似，后面会讲到在Eureka-server拦截请求的时候也用到了Jersy。</p><p>在这里调用底层类：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name"><span class="token namespace">com<span class="token punctuation">.</span>sun<span class="token punctuation">.</span>jersey<span class="token punctuation">.</span>api<span class="token punctuation">.</span>client<span class="token punctuation">.</span></span>Client</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>通过HTTP客户端发送http请求，并构建响应结果。</p><h3 id="eureka-server" tabindex="-1"><a class="header-anchor" href="#eureka-server" aria-hidden="true">#</a> Eureka-server</h3><p>在Eureka-server，配置好<code>yml</code>文件中必需的参数后，只需要一个注解开启：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@EnableEurekaServer</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>查看该注解的实现方法，发现为空白注解，并使用了<code>@Import</code>：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Import</span><span class="token punctuation">(</span><span class="token class-name">EurekaServerMarkerConfiguration</span><span class="token punctuation">.</span><span class="token keyword">class</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>查看<code>EurekaServerMarkerConfiguration</code>类的实现：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9219eac2b58f4e639b2ad3a68182c680~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure>`,20),u={href:"https://juejin.cn/post/7019224268000985125",target:"_blank",rel:"noopener noreferrer"},g=n(`<figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/97da9b63cb3647ae9427ea5cf4b59afd~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>发现Eureka server核心的自动配置类<code>EurekaServerAutoConfiguration</code></p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1540e0e8644745b7bbfd470a0306b1f6~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>我们看到，在这个类上有条件注入注解：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@ConditionalOnBean</span><span class="token punctuation">(</span><span class="token class-name">EurekaServerMarkerConfiguration<span class="token punctuation">.</span>Marker</span><span class="token punctuation">.</span><span class="token keyword">class</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>只有在Spring容器中存在Marker这个Bean时才会实例化这个类，所以<code>@EnableEurekaServer</code>就相当于一个开关，起到标识的作用。</p><p>在这个配置类中定义了拦截器，同样使用Jersy拦截请求：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/56fde61e89864bf8a16324c9d8b9b589~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p><code>ApplicationResource</code>类的<code>addInstance</code>方法接收请求，在对实例的信息进行验证后，向服务注册中心添加实例：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/133f5feb2f604c0094288ddf2962ff6c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进入<code>InstanceRegistry</code>的<code>register</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7960d469b3124cdab23471221fe86f2b~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在这里做了两个功能：</p><p>1、调用<code>handleRegistration</code>，在方法中使用<code>publishEvent</code>发布了监听事件 。Spring支持事件驱动，可以监听者模式进行事件的监听，这里广播给所有监听者，收到一个服务注册的请求。</p><p>至于监听器，可以由我们自己手写实现，参数中的事件类型spring会帮我们直接注入：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Component</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">EurekaRegisterListener</span> <span class="token punctuation">{</span>
  <span class="token annotation punctuation">@EventListener</span>
  <span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">registe</span><span class="token punctuation">(</span><span class="token class-name">EurekaInstanceRegisteredEvent</span> event<span class="token punctuation">)</span><span class="token punctuation">{</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span>event<span class="token punctuation">.</span><span class="token function">getInstanceInfo</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">getAppName</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>2、调用父类<code>PeerAwareInstanceRegistryImpl</code>的<code>register</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e8bfa88da400419ca69909d43a04a6ff~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进行了下面的操作：</p><p>① 拿到微服务的过期时间，并进行更新</p><p>② 将服务注册交给父类完成</p><p>③ 完成集群信息同步（这个会在后面说明）</p><p>调用父类<code>AbstractInstanceRegistry</code>的<code>register</code>方法，在这开始真正开始做服务注册。先说一下在这个类中定义的Eureka-server的服务注册列表的结构：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">ConcurrentHashMap</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">Map</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">Lease</span><span class="token punctuation">&lt;</span><span class="token class-name">InstanceInfo</span><span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span></span> registry<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p><code>ConcurrentHashMap</code>中外层的String表示服务名称；</p><p><code>Map</code>中的String表示服务节点的id （也就是实例的instanceid）；</p><p><code>Lease</code>是一个心跳续约的对象，<code>InstanceInfo</code>表示实例信息。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39ba660a4c06482a94c0a565326c286e~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>首先，注册表根据微服务的名称或取Map，如果不存在就新建，使用<code>putIfAbsent</code>。</p><p>然后，从<code>gMap</code>（gMap就是该服务的实例列表）获取一次服务实例，判断这个微服务的节点是否存在，第一次注册的情况下一般是不存在的</p><p>当然，也有可能会发生注册信息冲突时，这时Eureka会根据最后活跃时间来判断到底覆盖哪一个：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/549c0c8f804b47479b872dc6ab00466c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这段代码中，Eureka拿到存在节点的最后活跃时间，和当前注册节点的发起注册时间，进行对比。当存在的节点的最后活跃时间大于当前注册节点的时间，就说明之前存在的节点更活跃，就替换当前节点。</p><p>这里有一个思想，就是如果Eureka缓存的老节点更活跃，就说明它能够使用，而新来的服务我并不知道是否能用，那么Eureka就保守的使用了可用的老节点，从这一点也保证了可用性</p><p>在拿到服务实例后对其进行封装：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/16ec9d7500bc4d1ea46767b73fef4dc0~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>Lease是一个心跳续约的包装类，里面存放了注册信息，最后操作时间，注册时间，过期时间，剔除时间等信息。在这里把注册实例及过期时间放到这个心跳续约对象中，再把心跳续约对象放到<code>gmap</code>注册表中去。之后进行改变服务状态，系统数据统计，至此一个服务注册的流程就完成了。</p><p>注册完成后，查看一下<code>registry</code>中的服务实例，发现我们启动的Eureka-client都已经放在里面了：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ff19e924d4454721a0dcbc0a4509c29a~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><h2 id="服务续约" tabindex="-1"><a class="header-anchor" href="#服务续约" aria-hidden="true">#</a> 服务续约</h2><h3 id="eureka-client-1" tabindex="-1"><a class="header-anchor" href="#eureka-client-1" aria-hidden="true">#</a> Eureka-client</h3><p>服务续约由Eureka-client端主动发起，由之前介绍过的<code>DiscoveryClient</code>类中的<code>renew</code>方法完成，主要内容仍然是发送http请求：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ece9779e250e44c68f553ba22fa14e92~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>每隔30秒进行一次续约,调用<code>AbstractJerseyEurekaHttpClient</code>的<code>sendHeartBeat</code>方法:</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ac22625742fc4fcaa1ec9e001eb174e5~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><h3 id="eureka-server-1" tabindex="-1"><a class="header-anchor" href="#eureka-server-1" aria-hidden="true">#</a> Eureka-server</h3><p>在Eureka-server端，服务续约的调用链与服务注册基本相同：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">InstanceRegistry</span> # <span class="token function">renew</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
<span class="token class-name">PeerAwareInstanceRegistry</span> # <span class="token function">renew</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">-&gt;</span>
<span class="token class-name">AbstractInstanceRegistry</span> # <span class="token function">renew</span><span class="token punctuation">(</span><span class="token punctuation">)</span>v
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>主要看一下<code>AbstractInstanceRegistry</code> 的<code>renew</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab5fa4301f894d1382e617cb1c8863a0~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>先从注册表获取该服务的实例列表gMap，再从gMap中通过实例的id 获取具体的 要续约的实例。之后根据服务实例的<code>InstanceStatus</code>判断是否处于宕机状态，以及是否和之前状态相同。如果一切状态正常，最终调用<code>Lease</code>中的<code>renew</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b94cad4e00fa4ba4ad696a865bb06fe2~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>可以看出，其实服务续约的操作非常简单，它的本质就是修改服务的最后的更新时间。将最后更新时间改为系统当前时间加上服务的过期时间。值得提一下的是，<code>lastUpdateTimestamp</code>这个变量是被<code>volatile</code>关键字修饰的。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/758d4b3e74724a759f8df05013a3c382~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>之前的文章中我们讲过<code>volitaile</code>是用来保证可见性的。那么要被谁可见呢，提前说一下，这里要被服务剔除中执行的定时任务可见，后面会具体分析。</p><h2 id="服务剔除" tabindex="-1"><a class="header-anchor" href="#服务剔除" aria-hidden="true">#</a> 服务剔除</h2><h3 id="eureka-server-2" tabindex="-1"><a class="header-anchor" href="#eureka-server-2" aria-hidden="true">#</a> Eureka-server</h3><p>当Eureka-server发现有的实例没有续约超过一定时间，则将该服务从注册列表剔除，该项工作由一个定时任务完成的。该任务的定义过程比较复杂，仅列出其调用过程：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">EurekaServerInitializerConfiguration</span> # <span class="token function">start</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
<span class="token class-name">EurekaServerBootstrap</span> # <span class="token function">contextInitialized</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
                      # <span class="token function">initEurekaServerContext</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
<span class="token class-name">PeerAwareInstanceRegistryImpl</span> # <span class="token function">openForTraffic</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
<span class="token class-name">AbstractInstanceRegistry</span> # <span class="token function">postInit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1181721c1b634e0cb236fa3f0c093293~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在<code>AbstractInstanceRegistry</code>的<code>postInit</code>方法中，定义<code>EvictionTask</code>定时任务，构建定时器启动该任务，执行任务中剔除方法 <code>evict()</code>。</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">private</span> <span class="token keyword">long</span> evictionIntervalTimerInMs <span class="token operator">=</span> <span class="token number">60</span> <span class="token operator">*</span> <span class="token number">1000</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>任务的时间被定义为60秒，即默认每分钟执行一次。具体查看<code>evit()</code>剔除方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c2ef8efa38248e5a6de2732200b0ef9~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>实现了功能：</p><p>1、新建实例列表<code>expiredLeases</code>，用来存放过期的实</p><p>2、遍历<code>registry</code>注册表，对实例进行检测工作，使用<code>isExpired</code>方法判断实例是否过期：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8945595678654e05ba52a0e504e0195a~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>解释一下各个参数的意义：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>evictionTimestamp：剔除时间，当剔除节点的时候，将系统当前时间赋值给这个evictionTimestamp
additionalLeaseMs：集群同步产生的预留时间，这个时间是程序中传过来的
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>这里进行判断：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>系统当前时间 &gt; 最后更新时间 + 过期时间 + 预留时间
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>当该条件成立时，认为服务过期。在Eureka中过期时间默认定义为3个心跳的时间，一个心跳是30秒，因此过期时间是90秒。当该条件成立时，认为服务过期。在Eureka中过期时间默认定义为3个心跳的时间，一个心跳是30秒，因此过期时间是90秒</p><p>当以上两个条件之一成立时，判断该实例过期，将该过期实例放入上面创建的列表中。注意这里仅仅是将实例放入List中，并没有实际剔除。</p><p>在实际剔除任务前，需要提一下eureka的自我保护机制，当15分钟内，心跳失败的服务大于一定比例时，会触发自我保护机制。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d540b97aaf346df90aeb60a3bf44379~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这个值在Eureka中被定义为85%，一旦触发自我保护机制，Eureka会尝试保护其服务注册表中的信息，不再删除服务注册表中的数据。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bcea09d256f747fe8169b2a6ac6d0ee4~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>参数意义：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>registrySizeThreshold：根据阈值计算可以被剔除的服务数量最大值
evictionLimit：剔除后剩余最小数量
expiredLeases.size()：剔除列表的数量
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>上面的代码中根据自我保护机制进行了判断，使用Min函数计算两者的最小值，剔除较小数量的服务实例。</p><p>举个例子，假如当前共有100个服务，那么剔除阈值为85，如果list中有60个服务，那么就会剔除该60个服务。但是如果list中有95个服务，那么只会剔除其中的85个服务，在这种情况下，又会产生一个问题，eureka-server该如何判断去剔除哪些服务，保留哪些服务呢？</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82c4bc17954042b4a02f23c6ee672c4e~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里使用了随机算法进行剔除，保证不会连续剔除某个微服务的全部实例。最终调用<code>internalCancel</code>方法，实际执行剔除。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b78ead27ee14babb1cd6fca36e6853c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>其实剔除操作的实质非常简单，就是从<code>gMap</code>中<code>remove</code>掉这个节点，并从缓存中剔除。</p><h2 id="服务下线" tabindex="-1"><a class="header-anchor" href="#服务下线" aria-hidden="true">#</a> 服务下线</h2><h3 id="eureka-client-2" tabindex="-1"><a class="header-anchor" href="#eureka-client-2" aria-hidden="true">#</a> Eureka-client</h3><p>当eureka-client关闭时，不会立刻关闭，需要先发请求给eureka-server，告知自己要下线了。主要看一下客户端<code>shutdown</code>方法，其中调用关键的<code>unregister</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef554c934baa48b6b936e5bbeeb69545~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>调用<code>AbstractJerseyEurekaHttpClient</code> 的<code>cancel</code>方法</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df6638efe40047b9ae1dbfbd653d1455~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>发送http请求告诉eureka-server自己下线。</p><h3 id="eureka-server-3" tabindex="-1"><a class="header-anchor" href="#eureka-server-3" aria-hidden="true">#</a> Eureka-server</h3><p>调用<code>AbstractInstanceRegistry</code>中 <code>cancel</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d7ed07f187784a8ea6bfdcbd58784964~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>最终还是调用了和服务剔除中一样的方法，<code>remove</code>掉了<code>gMap</code>中的实例。</p><h2 id="服务发现" tabindex="-1"><a class="header-anchor" href="#服务发现" aria-hidden="true">#</a> 服务发现</h2><h3 id="eureka-client-3" tabindex="-1"><a class="header-anchor" href="#eureka-client-3" aria-hidden="true">#</a> Eureka-client</h3><p>在学习服务发现的源码前，先写一个测试用例：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Autowired</span>
<span class="token keyword">private</span> <span class="token class-name">DiscoveryClient</span> discoveryClient<span class="token punctuation">;</span>

<span class="token annotation punctuation">@GetMapping</span><span class="token punctuation">(</span><span class="token string">&quot;/find&quot;</span><span class="token punctuation">)</span>
<span class="token keyword">public</span> <span class="token keyword">void</span> <span class="token function">test</span><span class="token punctuation">(</span><span class="token class-name">String</span> id<span class="token punctuation">)</span><span class="token punctuation">{</span>
    <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">ServiceInstance</span><span class="token punctuation">&gt;</span></span> instances <span class="token operator">=</span> discoveryClient<span class="token punctuation">.</span><span class="token function">getInstances</span><span class="token punctuation">(</span>id<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span>instances<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>调用<code>DiscoveryClient</code> 的<code>getInstances</code>方法，可以根据服务id获取服务实例列表：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/939f50bd7c01456ca938250645b1bd2b~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>那么这里就有一个问题了，我们还没有去调用微服务，那么服务列表是什么时候被拉取或缓存到本地的服务列表的呢？答案是在这里调用了<code>CompositeDiscoveryClient</code> 的 <code>getInstances()</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dd266ca62a4f481eb7eba6ba7abdde9f~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>中间调用过程省略：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">EurekaDiscoveryClient</span> # <span class="token function">getInstances</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
<span class="token class-name">DiscoveryClient</span> # <span class="token function">getInstancesByVipAddress</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>
                # <span class="token function">getInstancesByVipAddress</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">-&gt;</span>  <span class="token comment">//和上面不是一个方法</span>
<span class="token class-name">Applications</span> # <span class="token function">getInstancesByVirtualHostName</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>查看<code>Applications</code>中的<code>getInstancesByVirtualHostName</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/96fbc1b3945445f6978da558e3765f7c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>发现一个名为<code>virtualHostNameAppMap</code>的Map集合中已经保存了当前所有注册到eureka的服务列表。</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">VipIndexSupport</span><span class="token punctuation">&gt;</span></span> virtualHostNameAppMap<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>也就是说，在我们没有手动去调用服务的时候，该集合里面已经有值了，说明在Eureka-server项目启动后，会自动去拉取服务，并将拉取的服务缓存起来。</p><p>那么追根溯源，来查找一下服务的发现究竟是什么时候完成的。回到<code>DiscoveryClient</code>这个类，在它的构造方法中定义了任务调度线程池<code>cacheRefreshExecutor</code>，定义完成后，调用<code>initScheduledTask</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef4e409be85545ccbbab04e71708e681~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在这个thread中，调用了<code>refreshRegistry()</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f2b414fc8444437aacec3eccb46bf87b~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在<code>fetchRegistry</code>方法中，执行真正的服务列表拉取：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/645d8498664744b6a37a38e2eca2a7dc~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在<code>fetchRegistry</code>方法中，先判断是进行增量拉取还是全量拉取：</p><p><strong>1、全量拉取</strong></p><p>当缓存为<code>null</code>，或里面的数据为空，或强制时，进行全量拉取，执行<code>getAndStoreFullRegistry</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bfd78860ceec46f5b94b4cfdd12a7f3b~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p><strong>2、增量拉取</strong></p><p>只拉取修改的，执行<code>getAndUpdateDelta</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9e7fc06f2d594c478490160de3441ada~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>①②：先发送http请求，获取在eureka-server中修改或新增的集合</p><p>③：判断，若拉取的集合为null，则进行全量拉取</p><p>④：更新操作，在<code>updateDelta</code>方法中，根据类型进行更改</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a028a96c01df42e890870cf42a60965e~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>⑤：获取一致性的hashcode值，用来校验eureka-server集合和本地是否一样</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67d61204782543fab58a7e58353d071c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在这进行判断，若远程集合的hash值等于缓存中的hash值，不需要拉取，否则再进行拉取一次。</p><p>最后提一下，<code>Applications</code>中定义的以下这些变量，都是在eureka-server中准备好的，直接拉取就可以了。</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">AbstractQueue</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Application</span><span class="token punctuation">&gt;</span></span> applications<span class="token punctuation">;</span>
<span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">Application</span><span class="token punctuation">&gt;</span></span> appNameApplicationMap<span class="token punctuation">;</span>
<span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">VipIndexSupport</span><span class="token punctuation">&gt;</span></span> virtualHostNameAppMap<span class="token punctuation">;</span>
<span class="token keyword">private</span> <span class="token keyword">final</span> <span class="token class-name">Map</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">VipIndexSupport</span><span class="token punctuation">&gt;</span></span> secureVirtualHostNameAppMap<span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>对服务发现过程进行一下重点总结：</p><ul><li>服务列表的拉取并不是在服务调用的时候才拉取，而是在项目启动的时候就有定时任务去拉取了，这点在<code>DiscoveryClient</code>的构造方法中能够体现；</li><li>服务的实例并不是实时的Eureka-server中的数据，而是一个本地缓存的数据；</li><li>缓存更新根据实际需求分为全量拉取与增量拉取。</li></ul><h2 id="集群信息同步" tabindex="-1"><a class="header-anchor" href="#集群信息同步" aria-hidden="true">#</a> 集群信息同步</h2><h3 id="eureka-server-4" tabindex="-1"><a class="header-anchor" href="#eureka-server-4" aria-hidden="true">#</a> Eureka-server</h3><p>集群信息同步发生在Eureka-server之间，之前提到在<code>PeerAwareInstanceRegistryImpl</code>类中，在执行<code>register</code>方法注册微服务实例完成后，执行了集群信息同步方法<code>replicateToPeers</code>，具体分析一下该方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1264f243021e4c34a38048532f60e69f~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>首先，遍历集群节点，用以给各个集群信息节点进行信息同步。</p><p>然后，调用<code>replicateInstanceActionsToPeers</code>方法，在该方法中根据具体的操作类型Action，选择分支，最终调用<code>PeerEurekaNode</code>的<code>register</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/493db40c81854a7fa2694746905ebaf9~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>最终发送http请求，但是与普通注册操作不同的时，这时将集群同步的标识置为true，说明注册信息是来自集群同步。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67857c1af8604d98b22df5b5d597085d~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在注册过程中运行到<code>addInstance</code>方法时，单独注册时<code>isReplication</code>的值为false，集群同步时为true。通过该值，能够避免集群间出现死循环，进行循环同步的问题。</p><h2 id="最后" tabindex="-1"><a class="header-anchor" href="#最后" aria-hidden="true">#</a> 最后</h2><p>到这里，Eureka声明周期中比较重要的六个部分我们就讲完了。由于篇幅有限，只能讲一下大致的流程，如果还想再深入了解一些，不妨自己看看源码，毕竟，源码是最好的老师。</p>`,148);function f(k,m){const s=l("ExternalLinkIcon");return p(),i("div",null,[c(" more "),d,e("p",null,[a("在这里只向spring容器中注入bean，没有任何意义。这里用到了Springboot的自动装配（这个不熟悉的可以参考"),e("a",u,[a("springboot零配置启动"),o(s)]),a("）：")]),g])}const v=t(r,[["render",f],["__file","Eureka.html.vue"]]);export{v as default};
