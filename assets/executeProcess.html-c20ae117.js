import{_ as a,W as n,X as e,$ as s,Z as p}from"./framework-9e67db09.js";const c={},o=p(`<p>我们在日常工作中广泛使用mybatis作为数据持久层框架，但是mybatis的执行流程是怎么样的，你了解过吗。本文将从源码角度，带你分析mybatis的工作原理。</p><p>先看一个简单的例子，以Service调用Mapper接口为，先写一个简单的Mapper：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">interface</span> <span class="token class-name">StudentMapper</span> <span class="token punctuation">{</span>
    <span class="token annotation punctuation">@Select</span><span class="token punctuation">(</span><span class="token string">&quot;select * from student&quot;</span><span class="token punctuation">)</span>
    <span class="token keyword">public</span> <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Map</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span><span class="token class-name">Object</span><span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span></span> <span class="token function">query</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在Servie中调用Mapper的方法：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Service</span><span class="token punctuation">(</span><span class="token string">&quot;studentService&quot;</span><span class="token punctuation">)</span>
<span class="token keyword">public</span> <span class="token keyword">class</span> <span class="token class-name">StudentServiceImpl</span> <span class="token keyword">implements</span> <span class="token class-name">StudentService</span> <span class="token punctuation">{</span>
    <span class="token annotation punctuation">@Autowired</span>
    <span class="token class-name">StudentMapper</span> studentMapper<span class="token punctuation">;</span>

    <span class="token annotation punctuation">@Override</span>
    <span class="token keyword">public</span> <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">Map</span><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">Object</span><span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span></span> <span class="token function">query</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">return</span> studentMapper<span class="token punctuation">.</span><span class="token function">select</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>向Service中注入这个Mapper并调用时，你知道这时注入的是什么吗？</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c43792018c694f83907f08df9c40dbcd~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>通过调试，可以知道这时实际的studentMapper是一个类型为<code>MapperProxy</code>的代理对象，下面将从myabtis环境初始化开始，具体分析代理对象的产生过程。</p><h3 id="一、配置sqlsessionfactorybean-时都做了什么" tabindex="-1"><a class="header-anchor" href="#一、配置sqlsessionfactorybean-时都做了什么" aria-hidden="true">#</a> 一、配置SqlSessionFactoryBean 时都做了什么？</h3><p>在进行spring和mybatis整合时，会用xml或者注解的方式去配置一个<code>SqlSessionFactoryBean</code>，本文中以注解方式为例：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Bean</span>
<span class="token keyword">public</span> <span class="token class-name">SqlSessionFactoryBean</span> <span class="token function">sqlSessionFactoryBean</span><span class="token punctuation">(</span><span class="token class-name">DataSource</span> dataSource<span class="token punctuation">)</span><span class="token punctuation">{</span>
   <span class="token class-name">SqlSessionFactoryBean</span> sqlSessionFactoryBean<span class="token operator">=</span><span class="token keyword">new</span> <span class="token class-name">SqlSessionFactoryBean</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
   sqlSessionFactoryBean<span class="token punctuation">.</span><span class="token function">setDataSource</span><span class="token punctuation">(</span>dataSource<span class="token punctuation">)</span><span class="token punctuation">;</span>
   <span class="token keyword">return</span>  sqlSessionFactoryBean<span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>看一下<code>SqlSessionFactoryBean</code>的继承实现关系：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/276dbb2054d642fea358b61582abb502~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>先铺垫一下spring中两个非常重要的接口，<code>FactoryBean</code>和<code>InitializingBean</code>。</p><p><strong>FactoryBean：</strong></p><p><code>FactoryBean</code>是一个spring中比较特殊的Bean，通过它的<code>getObject()</code>方法可以返回一个对象实例。<code>SqlSessionFactoryBean</code>中<code>getObject()</code>方法的实现：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/90f10342bef043958d5a5e1f97c203e7~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在这里用于创建并返回一个<code>SqlSessionFactory</code>，在 spring +mybatis 的环境下，我们使用<code>SqlSessionFactoryBean</code>来充当<code>SqlSessionFactory</code>。</p><p><strong>InitializingBean：</strong></p><p><code>InitializingBean</code>接口中只有一个方法，<code>afterPropertiesSet()</code>，所有实现了该接口的类，在bean的初始化之前都要调用这个方法。可以看出在上面的<code>getObject</code>方法中，如果<code>SqlSessionFactory</code>为空，会调用这个方法创建<code>SqlSessionFactory</code>。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d23861fcd7d04180b869006e937b287c~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>通过调用<code>SqlSessionFactoryBuilder</code>的<code>build</code>方法，最终返回了一个<code>DefaultSqlSessionFactory</code>实例，这个<code>DefaultSqlSessionFactory</code>中保存了一个非常重要的<code>Configuration</code>对象。</p><h3 id="二、-mapperscan都做了什么" tabindex="-1"><a class="header-anchor" href="#二、-mapperscan都做了什么" aria-hidden="true">#</a> 二、@MapperScan都做了什么？</h3><p>在注解配置mybatis时，通过<code>@MapperScan</code>指定Mapper存放的包，就能自动为我们把接口实现成类。那么这是怎么实现的呢？</p><p>点开<code>@MapperScan</code>的源码，发现上面还有一行非常重要的注解：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token annotation punctuation">@Import</span><span class="token punctuation">(</span><span class="token class-name">MapperScannerRegistrar</span><span class="token punctuation">.</span><span class="token keyword">class</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ff40e87d3d6b4584aacfa8b4543dd175~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p><code>ImportBeanDefinitionRegistrar</code>接口提供<code>registerBeanDefinitions</code>方法向用户暴露了<code>BeanDefinitionRegistry</code>，也就是说可以让用户手动创建<code>BeanDefinition</code>并使用该注册器注册到spring容器中。</p><p>查看<code>MappercannerRegistrar</code>的方法<code>registerBeanDefinitions</code>中的核心代码：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token class-name">ClassPathMapperScanner</span> scanner <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ClassPathMapperScanner</span><span class="token punctuation">(</span>registry<span class="token punctuation">)</span><span class="token punctuation">;</span>
……
scanner<span class="token punctuation">.</span><span class="token function">doScan</span><span class="token punctuation">(</span><span class="token class-name">StringUtils</span><span class="token punctuation">.</span><span class="token function">toStringArray</span><span class="token punctuation">(</span>basePackages<span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>主要是创建了一个Mapper扫描器，开启扫描。看看<code>ClassPathMapperScanner</code>中<code>doScan</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e50d2dda3a0427bb7f39c8658ff4ca9~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这里对生成的mapper的bean定义做了进一步处理。进入<code>processBeanDefinitions()</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99d0d6a347574f5db9bdac7b99723e16~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>注意画框代码及上方的注释，先看一下从<code>BeanDefinitionHolder</code>获得<code>BeanDefinition时beanClass</code>初始的值：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cfdcf186c5304614be6024d0b6d18290~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>等待<code>setBeanClass</code>执行完毕：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e341eafe76d486e825f67f5946e9de8~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>通过<code>definition.setBeanClass()</code>把原来的BeanClass的类型替换成了<code>MapperFactoryBean</code>类型。到这，完成了Mapper接口加载定义阶段中非常重要的一步，而这也是生成代理对象<code>MapperProxy</code>的关键。</p><h3 id="三、mybatis如何生成代理对象" tabindex="-1"><a class="header-anchor" href="#三、mybatis如何生成代理对象" aria-hidden="true">#</a> 三、mybatis如何生成代理对象？</h3><p>看一下<code>MapperFactoryBean</code>的继承关系：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7637d2a77c264a4cad70f8c0f33eb656~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p><code>MapperFactoryBean</code>继承的<code>SqlSessionDaoSupport</code>类实现了<code>InitializingBean</code>接口，那么我们还是首先找<code>afterPropertiesSet()</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/75d3bf5051e141f8b29bb48f35bb27b9~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p><code>DaoSupport</code>中，最终调用<code>MapperFactoryBea</code>n中的方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73c30aa2b29d46bfae2a25b73ca41d04~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>首先通过获取<code>sqlSession</code>获得了非常重要的配置类<code>Configuration</code>，然后查看一下<code>addMapper</code>方法，最终调用的是<code>MapperRegistry</code>的<code>addMapper</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a972b1ea2a5e401eb70885fdf110cd8c~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>红框中的代码为我们创建了Mapper 的代理工厂对象（还不是Mapper的代理对象），并把它放入了<code>knownMappers</code>这个Map中。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57bcd545c10b4411bcb6b8b7265e16a6~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在这一步，只是简单初始化了<code>MapperProxyFactory</code>，把我们自己的mapper的类型传给了它，还并没有真正产生代理对象。</p><p><code>MapperRegistry</code>并在之后的<code>parse()</code>方法中完成了xml文件的解析，每一个sql方法都被解析成了一个<code>MappedStatement</code>对象，并添加到了配置类<code>Configuration</code>对象中。</p><p><strong>MapperFactoryBean最终返回了什么？</strong></p><p>因为<code>MapperFactoryBean</code>实现了<code>FactoryBean</code>接口，所以我们看看<code>getObject</code>方法究竟返回了什么：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47ed191a65134346b5de2360d6a88f26~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f75a08ed5dc4ceebc57a6e0485e6c0f~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>最终调用<code>MapperRegistry的getMapper</code>方法：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82dd21201a8241eaa3489e0950b8b765~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>这里调用的了mybatis刚才生成的<code>MapperProxyFactory</code>，帮助我们实例化并返回了一个代理对象。</p><p><code>MapperProxyFactory</code>中使用<code>newInstance</code>方法，实例化<code>MapperProxy</code>，用于生成代理：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/443c672acdc74be2b216ad6077ab11ba~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>至此，我们已经弄明白了文章开头的<code>MapperProxy</code>是如何生成的。</p><h3 id="四、mapperproxy代理对象如何执行sql语句" tabindex="-1"><a class="header-anchor" href="#四、mapperproxy代理对象如何执行sql语句" aria-hidden="true">#</a> 四、MapperProxy代理对象如何执行sql语句？</h3><p>在StudentServiceImpl中的query方法中打一个断点跟踪语句，你会发现实际执行的就是代理类<code>MapperProxy</code>中的<code>invoke()</code>方法。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b6c9d4f84714ff2b95f2dfe143b22fe~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p><code>MapperProxy</code>在作为代理类的同时，自身实现了<code>InvocationHandler</code>接口，所以<code>invoke</code>方法就是真正执行的代理逻辑。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b266543370284d61ba3bf2b664d01c36~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在这里最终调用了<code>MapperMethod</code>的<code>execute</code>方法实际去执行了sql语句。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e40bcff1ce174d97822e748b873d70df~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在该方法中，根据sql语句执行类型，调用<code>sqlSession</code>对应的方法执行并将结果返回给用户。至此，mybatis在spring环境下一次调用全部完成。</p>`,70);function t(i,d){return n(),e("div",null,[s(" more "),o])}const r=a(c,[["render",t],["__file","executeProcess.html.vue"]]);export{r as default};