import{_ as n,W as e,X as a,$ as c,Z as o}from"./framework-9e67db09.js";const s={},t=o(`<p>Feign作为一个声明式的Http服务客户端，通过接口加注解的方式，就能够完成对服务提供方接口的调用，极大的简化了我们在调用服务时的工作。</p><p>那么在只有接口的条件下，Feign是如何基于接口实现服务调用的呢？在之前的代理模式及mybatis实现原理的文章中，我们知道了可以通过动态代理的方式生成代理对象。Feign是否这样实现的呢，我们从源码角度进行分析。</p><h2 id="_1、初始化阶段" tabindex="-1"><a class="header-anchor" href="#_1、初始化阶段" aria-hidden="true">#</a> 1、初始化阶段</h2><p>首先看一下Feign的开启注解<code>@EnableFeignClients</code>：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Retention</span><span class="token punctuation">(</span><span class="token class-name">RetentionPolicy</span><span class="token punctuation">.</span><span class="token constant">RUNTIME</span><span class="token punctuation">)</span>
<span class="token annotation punctuation">@Target</span><span class="token punctuation">(</span><span class="token class-name">ElementType</span><span class="token punctuation">.</span><span class="token constant">TYPE</span><span class="token punctuation">)</span>
<span class="token annotation punctuation">@Documented</span>
<span class="token annotation punctuation">@Import</span><span class="token punctuation">(</span><span class="token class-name">FeignClientsRegistrar</span><span class="token punctuation">.</span><span class="token keyword">class</span><span class="token punctuation">)</span>
<span class="token keyword">public</span> <span class="token annotation punctuation">@interface</span> <span class="token class-name">EnableFeignClients</span> <span class="token punctuation">{</span>
  <span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token function">value</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">default</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span>
  <span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token function">basePackages</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">default</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span>
  <span class="token class-name">Class</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token operator">?</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token function">basePackageClasses</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">default</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span>
  <span class="token class-name">Class</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token operator">?</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token function">defaultConfiguration</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">default</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span>
  <span class="token class-name">Class</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token operator">?</span><span class="token punctuation">&gt;</span></span><span class="token punctuation">[</span><span class="token punctuation">]</span> <span class="token function">clients</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token keyword">default</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>@Import</code>导入了<code>FeignClientsRegistrar</code>，该类实现了<code>ImportBeanDefinitionRegistrar</code>接口，在该接口的<code>registerBeanDefinitions</code>方法中，spring向外暴露了<code>BeanDefinitionRegistry</code>注册器。</p><p>用户如果需要手动创建或修改<code>BeanDefinition</code>，可以通过把<code>BeanDefinition</code>注册到<code>BeanDefinitionRegistry</code>的方式，之后spring会帮我们实例化bean并放在容器中。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c50268994c1d426db0a3e8b257e720a7~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>里面两个方法中，<code>registerDefaultConfiguration</code>方法主要用于读取配置信息，我们主要看一下<code>registerFeignClients</code>方法的实现：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6334bc7d1da84e38a66c9ada829b89ee~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里首先定义了一个扫描器，并读取<code>@EnableFeignClients</code>注解的属性，配置<code>FeignClient</code>的注解类型过滤器，用以在后面进行进行包扫描操作。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/93f94ab741c5489b8738bc3ddf3d6c67~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>通过扫描，得到所有在<code>basepackage</code>定义的路径下的被<code>@FeignClient</code>注解标记的类的<code>BeanDefinition</code>。</p><p>读取<code>@FeignClient</code>注解的内容，并存放在一个Map中，由于我在注解中只指定了<code>name</code>，因此只存在<code>name</code>和<code>value</code>的值（value通过<code>@AliasFor</code>指定为<code>name</code>的别名）</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/88438876a855491988024a07d3f088bf~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>之后，调用<code>registerFeignClient</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b65b2e2e1af34762b4debf3ebfbbbd82~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>注意这里通过<code>BeanDefinitionBuilder</code>创建的是一个<code>FeignClientFactoryBean</code>类型的工厂<code>bean</code>，注意通过它的<code>getObject</code>返回的才是我们的<code>FeignClient</code>。之后通过<code>BeanDefinitionBuilder</code>填充<code>FeignClient</code>对象的属性，并获得<code>BeanDefinition</code>。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6e899e54b7a74e3aa60f70de65a59e44~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里的<code>BeanDefinitionHolder</code>可以理解为<code>BeanDefinition</code>的包装类，提供了根据<code>beanName</code>获取<code>BeanDefinition</code>的方法，可以理解为额外加了一层封装。</p><p>完成属性填充后，通过Spring提供的<code>registerBeanDefinition</code>方法向<code>BeanDefinitionRegistry</code>注册了刚实例化的这个<code>BeanDefinitionHolder</code>。这里完成的是将<code>FeignClient</code>注解的类的信息交给工厂bean代理类，并将代理类的定义注册到Spring的容器中。</p><p>至此，已经把要创建的接口代理对象的信息放入<code>registry</code>里面，之后spring在启动调用<code>refresh</code>方法的时候会负责bean的实例化。在实例化过程中，调用<code>FeignClientFactoryBean</code>的<code>getObject</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/77fb011bca084077a585081197f6a2cc~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>其中调用了<code>loadBalance</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa6340d7ff3542c5a26b22368eaf9ae4~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里创建的<code>Client</code>实例是一个<code>LoadBalancerFeignClient</code>的对象。<code>Client</code>是一个非常重要的组件，看一下配置类中注入的实例：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Configuration</span>
<span class="token keyword">class</span> <span class="token class-name">DefaultFeignLoadBalancedConfiguration</span> <span class="token punctuation">{</span>
 <span class="token annotation punctuation">@Bean</span>
 <span class="token annotation punctuation">@ConditionalOnMissingBean</span>
 <span class="token keyword">public</span> <span class="token class-name">Client</span> <span class="token function">feignClient</span><span class="token punctuation">(</span><span class="token class-name">CachingSpringLoadBalancerFactory</span> cachingFactory<span class="token punctuation">,</span>
               <span class="token class-name">SpringClientFactory</span> clientFactory<span class="token punctuation">)</span> <span class="token punctuation">{</span>
   <span class="token keyword">return</span> <span class="token keyword">new</span> <span class="token class-name">LoadBalancerFeignClient</span><span class="token punctuation">(</span><span class="token keyword">new</span> <span class="token class-name">Client<span class="token punctuation">.</span>Default</span><span class="token punctuation">(</span><span class="token keyword">null</span><span class="token punctuation">,</span> <span class="token keyword">null</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
       cachingFactory<span class="token punctuation">,</span> clientFactory<span class="token punctuation">)</span><span class="token punctuation">;</span>
 <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在没有配置<code>Client</code>的情况下，会注入一个<code>LoadBalancerFeignClient</code>，其中<code>delegate</code>属性中注入了一个<code>Client$Default</code>对象，我们可以暂时理解为代理，后面就会讲到，Feign发送Request请求以及接收Response响应，都是借助<code>Client$Default</code>对象完成的。</p><p>可以回想一下之前Ribbon中讲过的<code>RibbonLoadBalancerClient</code>，Ribbon是使用拦截器后调用了它的<code>execute</code>方法。那么我们可以猜测一下，这里是不是使用什么方式最终了调用<code>LoadBalancerFeignClient</code>的<code>execute</code>方法呢？这个问题我们放在后面去证实。</p><h2 id="_2、创建代理对象" tabindex="-1"><a class="header-anchor" href="#_2、创建代理对象" aria-hidden="true">#</a> 2、创建代理对象</h2><p>接着看上面<code>loadBalance</code>方法中，首先调用了<code>HystrixTargeter</code>的<code>target</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/55ae381845fb4ea68f031c47c339c702~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>之后调用了Feign的<code>target</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3e929a5aab404b42942da1e5de424336~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>最终调用了<code>ReflectiveFeign</code>类中的<code>newInstance</code>方法。其中名为<code>nameToHandler</code>的Map中存储了<code>FeignClient</code>接口中定义的方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cf721c1ed7b6410381421b5d09ffd31e~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>看到下面的<code>InvocationHandler</code>和<code>Proxy</code>就很清楚了，和我们在开头说的一样，这里是使用JDK动态代理的方式创建代理对象。创建<code>InvocationHandler</code>及代理对象过程</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b9c7df2c2bf440058fb15d84d7ddad5b~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里的<code>factory</code>是<code>InvocationHandlerFactory</code>的对象，看一下它的<code>create</code>方法，用于创建<code>FeignInvocationHandler</code>实例来对方法进行拦截。在构造方法中传入了代理类的接口，以及需要代理的方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c0c57898b0a45bb8564d60db269ecab~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><h2 id="_3、拦截方法" tabindex="-1"><a class="header-anchor" href="#_3、拦截方法" aria-hidden="true">#</a> 3、拦截方法</h2><p>通过JDK动态代理我们知道，在<code>InvocationHandler</code>中，<code>invoke</code>方法对进行方法拦截和逻辑增强。那么我们使用一个测试接口，看一下关键的<code>invoke</code>方法是如何工作的：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/22d2fa5b20a145ef92dc018ce82fa930~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>首先根据方法名去判断是不是<code>Object</code>类内置的一些方法，都不是则往下，执行了一个分发的操作，这个<code>dispatch</code>是初始化阶段生成的<code>MethodHandler</code>列表。调用<code>SynchronousMethodHandler</code>类的<code>invoke</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/69f966213ffa417a8a6ea627a3806273~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>使用<code>RequestTemplate</code>创建了一个http请求的模板，可以看见这里创建了一个请求：</p><div class="language-http line-numbers-mode" data-ext="http"><pre class="language-http"><code><span class="token request-line"><span class="token method property">GET</span> <span class="token request-target url">/user/1</span> <span class="token http-version property">HTTP/1.1</span></span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>进入<code>executeAndDecode</code>方法，在该方法中，首先使用刚才创建的模板生成了一个Request请求，并且把我们本次调用的服务名和接口名拼接在了一起：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/919196af9a78426fb45d3baffa886254~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里把请求交给了之前创建的<code>LoadBalancerFeignClient</code>，执行了它的<code>execute</code>方法。和开头说的一样，和Ribbon类似的调用流程。只不过需要区别一下的是，Ribbon是使用拦截器拦截请求，而Feign是使用动态代理的<code>invoke</code>方法对方法进行拦截并转发。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3770ed204a2f4e988e4cc554d65164e7~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进入<code>LoadBalancerFeignClient</code>的<code>execute</code>方法，在其中构建了一个<code>RibbonRequest</code>的请求：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66818f1cc827410e8bf68cf3d43a586f~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在上面的<code>uriWithoutHost</code>中，去除了<code>url</code>中的服务名。这么做是因为Feign其实只需要这个服务后面的接口字符串，至于如何选择服务与负载均衡，都交给了Ribbon去做。</p><p>进入<code>RibbonRequest</code>的构造方法中，可以看见，用的Client的实现类是<code>Client$Default</code>对象，即前面讲到的在配置文件中，<code>LoadBalancerFeignClient</code>中<code>delegate</code>存储的对象。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/857983225998443d95220332174ab300~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>调用<code>AbstractLoadBalancerAwareClient</code>的<code>executeWithLoadBalancer</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e332a6b30a3a4ffab87a24ce3c0cfb1c~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进入其<code>submit</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d624b826fd3348eea3f85b4e019c8591~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进入<code>selectServer</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b07879ad016a43fe8c0b4469bd5219e0~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>进入<code>LoadBalancerContext</code>的<code>getServerFromLoadBalancer</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d8792a80359a4b98adc1f6515c8cf41e~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>在这里结合了Ribbon，完成负载均衡，根据负载均衡算法选择Server。之后通过调用<code>FeignLoadBalancer</code>的<code>execute</code>方法，再调用<code>Client$Default</code>的<code>execute</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c67e57eb0639477da97e300af4a4abf9~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>调用<code>convertAndSend</code>创建了一个<code>HttpURLConnection</code>的连接，最后发起远程调用还是用的<code>HttpURLConnection</code>，并在<code>convertResponse</code>方法中封装结果，至此一次调用过程完成。</p><p>到这里，我们就能明白为什么说Feign是一个Web客户端并不准确，其实它并没有完成任何请求处理操作，只是一个伪客户端，最终还是调用其他组件完成的请求发送与接收。</p><h2 id="总结" tabindex="-1"><a class="header-anchor" href="#总结" aria-hidden="true">#</a> 总结</h2><p>最后，对Feign的实现流程进行一下总结：</p><p>1、使用JDK动态代理为接口创建代理对象</p><p>2、执行接口的方法时，调用代理对象的invoker方法</p><p>3、读取FeignClient的注解得到要调用的远程服务的接口</p><p>4、通过Ribbon负载均衡得到一个要调用的服务提供者</p><p>5、使用HttpURLConnection发起请求，得到响应</p>`,75);function i(p,d){return e(),a("div",null,[c(" more "),t])}const u=n(s,[["render",i],["__file","Feign.html.vue"]]);export{u as default};