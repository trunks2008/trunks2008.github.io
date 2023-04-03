import{_ as i,W as d,X as l,$ as r,Y as e,a0 as s,a1 as n,Z as c,C as o}from"./framework-9e67db09.js";const t={},p=c(`<p>在前面的文章 <code>Redis：我是如何与客户端进行通信的</code>中，我们介绍过RESP V2版本协议的规范，RESP的全程是<code>Redis Serialization Protocol</code>，基于这个实现简单且解析性能优秀的通信协议，Redis的服务端与客户端可以通过底层命令的方式进行数据的通信。</p><p>随着Redis版本的不断更新以及功能迭代，RESP V2协议开始渐渐无法满足新的需求，为了适配在Redis6.0中出现的一些新功能，在它的基础上发展出了全新的下一代RESP3协议。</p><p>下面我们先来回顾一下继承自RESP V2的5种数据返回类型，在了解这些类型的局限性后，再来看看RESP3中新的数据返回类型都在什么地方做出了改进。</p><h2 id="继承resp-v2的类型" tabindex="-1"><a class="header-anchor" href="#继承resp-v2的类型" aria-hidden="true">#</a> 继承RESP v2的类型</h2><p>首先，协议中数据的请求格式与RESP V2完全相同，请求的格式如下：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*<span class="token operator">&lt;</span>参数数量<span class="token operator">&gt;</span> CRLF
$<span class="token operator">&lt;</span>参数1的字节长度<span class="token operator">&gt;</span> CRLF
<span class="token operator">&lt;</span>参数1的数据<span class="token operator">&gt;</span> CRLF
$<span class="token operator">&lt;</span>参数2的字节长度<span class="token operator">&gt;</span> CRLF
<span class="token operator">&lt;</span>参数2的数据<span class="token operator">&gt;</span> CRLF
<span class="token punctuation">..</span>.
$<span class="token operator">&lt;</span>参数N的字节长度<span class="token operator">&gt;</span> CRLF
<span class="token operator">&lt;</span>参数N的数据<span class="token operator">&gt;</span> CRLF
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>每行末尾的<code>CRLF</code>转换成程序语言是<code>\\r\\n</code>，也就是回车加换行。以<code>set name hydra</code>这条命令为例，转换过程及转换后的结果如下：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24cc676508a24f2f8a38bce097c95c57~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>在了解了发送的协议后，下面对不同类型的回复进行测试。这一过程如何进行模拟呢？在前面的文章中，我们是在java代码中通过<code>Socket</code>连接redis服务，发送数据并收到返回结果来模拟这一协议。</p><p>不过我们今天采用一种更为简单的方式，直接在命令行下使用<code>telnet</code>进行连接就可以了，以我本机启动的redis为例，直接输入<code>telnet 127.0.0.1 6379</code>就可以连接到redis服务了。之后再将包含换行的指令一次性拷贝到命令行，然后回车，就能够收到来自Redis服务的回复了：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c219cfed2d474883901acbc4e60b6493~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>下面先来看看继承自RESP V2的5种返回格式，为了统一命名规范，介绍中均采用RESP3官方文档中的新的名称来替代RESP V2中的旧命名，例如不再使用旧的<strong>批量回复</strong>、<strong>多条批量回复</strong>等类型名称。</p><h3 id="simple-string" tabindex="-1"><a class="header-anchor" href="#simple-string" aria-hidden="true">#</a> Simple string</h3><p>表示简单字符串回复，它只有一行回复，回复的内容以<code>+</code>作为开头，不允许换行，并以<code>\\r\\n</code>结束。有很多指令在执行成功后只会回复一个<code>OK</code>，使用的就是这种格式，能够有效地将传输、解析的开销降到最低。</p><p>还是以上面的<code>set</code>指令为例，发送请求：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*3
<span class="token variable">$3</span>
<span class="token builtin class-name">set</span>
<span class="token variable">$4</span>
name
<span class="token variable">$5</span>
hydra
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>收到回复：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>+OK<span class="token punctuation">\\</span>r<span class="token punctuation">\\</span>n
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><h3 id="simple-error" tabindex="-1"><a class="header-anchor" href="#simple-error" aria-hidden="true">#</a> Simple error</h3><p>错误回复，它可以看做简单字符串回复的变种形式，它们之间的格式也非常类似，区别只有第一个字符是以-作为开头，错误回复的内容通常是错误类型及对错误描述的字符串。错误回复出现在一些异常的场景，例如当发送了错误的指令、操作数的数量不对时，都会进行错误回复。</p><p>发送一条错误的指令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*1
<span class="token variable">$8</span>
Dr.Hydra
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>收到回复，提示错误信息：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token parameter variable">-ERR</span> unknown <span class="token builtin class-name">command</span> <span class="token variable"><span class="token variable">\`</span>Dr.Hydra<span class="token variable">\`</span></span>, with args beginning with:<span class="token punctuation">\\</span>r<span class="token punctuation">\\</span>n
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><h3 id="number" tabindex="-1"><a class="header-anchor" href="#number" aria-hidden="true">#</a> Number</h3><p>整数回复，它的应用也非常广泛，它以<code>:</code>作为开头，以<code>\\r\\n</code>结束，用于返回一个整数。例如当执行<code>incr</code>后返回自增后的值，执行<code>llen</code>返回数组的长度，或者使用<code>exists</code>命令返回的0或1作为判断一个key是否存在的依据，这些都使用了整数回复。</p><p>发送一条查看数组长度的指令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*2
<span class="token variable">$4</span>
llen
<span class="token variable">$7</span>
myarray
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>收到回复：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>:4<span class="token punctuation">\\</span>r<span class="token punctuation">\\</span>n
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><h3 id="blob-string" tabindex="-1"><a class="header-anchor" href="#blob-string" aria-hidden="true">#</a> Blob string</h3><p>多行字符串的回复，也被叫做批量回复，在RESP V2中将它称为<code>Bulk String</code>。以<code>$</code>作为开头，后面是发送的字节长度，然后是<code>\\r\\n</code>，然后发送实际的数据，最终以<code>\\r\\n</code>结束。如果要回复的数据不存在，那么回复长度为-1。</p><p>发送一条<code>get</code>命令请求：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*2
<span class="token variable">$3</span>
get
<span class="token variable">$4</span>
name
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>收到回复：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$5</span><span class="token punctuation">\\</span>r<span class="token punctuation">\\</span>n
hydra<span class="token punctuation">\\</span>r<span class="token punctuation">\\</span>n
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="array" tabindex="-1"><a class="header-anchor" href="#array" aria-hidden="true">#</a> Array</h3><p>可以理解为RESP V2中的<strong>多条批量回复</strong>，当服务端要返回多个值时，例如返回一些元素的集合时，就会使用<code>Array</code>。它以<code>*</code>作为开头，后面是返回元素的个数，之后再跟随多个上面的<code>Blob String</code>。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*4
<span class="token variable">$6</span>
lrange
<span class="token variable">$7</span>
myarray
<span class="token variable">$1</span>
<span class="token number">0</span>
<span class="token variable">$2</span>
<span class="token parameter variable">-1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>收到回复，包含了集合中的4个元素：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*4
<span class="token variable">$1</span>
<span class="token number">1</span>
<span class="token variable">$1</span>
<span class="token number">2</span>
<span class="token variable">$1</span>
<span class="token number">2</span>
<span class="token variable">$2</span>
<span class="token number">32</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这5种继承自RESP V2协议的返回数据类型的简单回顾到此结束，下面我们来开启RESP3协议新特性的探索之旅。</p><h2 id="resp3中新的类型" tabindex="-1"><a class="header-anchor" href="#resp3中新的类型" aria-hidden="true">#</a> RESP3中新的类型</h2><p>目前在Redis6.0.X版本中，仍然是默认使用的RESP V2协议，并且在兼容RESP V2的基础上，也同时也支持开启RESP3。估计在未来的某个版本，Redis可能会全面切换到RESP3，不过这么做的话对目前的Redis客户端连接工具会有不小的冲击，都需要根据协议内容进行底层通信的改造。</p><p>在使用<code>telnet</code>连接到redis服务后，先输入下面的命令来切换到RESP3版本的协议，至于<code>hello</code>命令的具体返回数据以及数据表示的意义，这里暂且略过，后面会具体来看。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>hello <span class="token number">3</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>下面我们就来详细看看在RESP3中，除了保留上面的5种旧回复类型外，新增的13种通信返回数据类型，部分数据类型会配合示例进行演示。<strong>为了看起来更加简洁，下面的演示例子发送命令均使用原始命令，不再转化为协议格式，并且省略数据返回结果中每行结束的</strong><code>\\r\\n</code><strong>！</strong></p><h3 id="_1、null" tabindex="-1"><a class="header-anchor" href="#_1、null" aria-hidden="true">#</a> 1、Null</h3><p>新协议中使用下划线字符后跟<code>CR</code>和<code>LF</code>字符来表示空值，也就是用<code>_\\r\\n</code>来替代原先的单个空值的返回<code>$-1</code>。例如在使用<code>get</code>命令查找一个不存在的key时：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>get hydra
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP V2返回：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>$-1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP3返回：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>_
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><h3 id="_2、double" tabindex="-1"><a class="header-anchor" href="#_2、double" aria-hidden="true">#</a> 2、Double</h3><p>浮点数返回时以逗号开头，格式为 <code>,&lt;floating-point-number&gt;\\r\\n</code>，使用<code>zset score key member</code>获取分数的命令来进行测试：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>zscore fruit apple
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP V2返回时使用的是<code>Bulk String</code>的格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$18</span>
<span class="token number">5.6600000000000001</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>RESP3返回格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>,5.6600000000000001
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><h3 id="_3、boolean" tabindex="-1"><a class="header-anchor" href="#_3、boolean" aria-hidden="true">#</a> 3、Boolean</h3><p>布尔类型的数据返回值，其中true被表示为<code>#t\\r\\n</code>，而false被表示为<code>#f\\r\\n</code>。不过Hydra暂时没有找到返回布尔类型结果的例子，即使是用lua脚本直接返回布尔类型也无法实现。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token builtin class-name">eval</span> <span class="token string">&quot;return true&quot;</span> <span class="token number">0</span> 
<span class="token builtin class-name">eval</span> <span class="token string">&quot;return false&quot;</span> <span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>上面的lua脚本在返回true时结果为<code>:1\\r\\n</code>，返回false时结果为<code>_\\r\\n</code>，这是因为lua中布尔类型的true会转换为redis中的整数回复1，而false类型会转换成<code>Nil Bulk</code>。至于有哪些指令能够返回布尔类型的数据，有了解的小伙伴可以给我留言补充。</p><h3 id="_4、blob-error" tabindex="-1"><a class="header-anchor" href="#_4、blob-error" aria-hidden="true">#</a> 4、Blob error</h3><p>与字符串类型比较相似，它的格式为<code>!&lt;length&gt;\\r\\n&lt;bytes&gt;\\r\\n</code>，但是与简单错误类型一样，开头使用<code>!</code>表示返回的是一段错误信息描述。例如错误<code>SYNTAX invalid syntax</code>会按照下面的格式返回：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">!</span><span class="token number">21</span>
SYNTAX invalid syntax
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_5、verbatim-string" tabindex="-1"><a class="header-anchor" href="#_5、verbatim-string" aria-hidden="true">#</a> 5、Verbatim string</h3><p><code>Verbatim string</code>也表示一个字符串格式，与<code>Blob String</code>非常相似，但是使用<code>=</code>开头替换了<code>$</code>，另外之后的三个字节提供了有关字符串格式的信息，例如<code>txt</code>表示纯文本，<code>mkd</code>表示markdown格式，第四个字节则固定为 <code>:</code>。这种格式适用于在没有任何转义或过滤的情况下显示给用户。</p><p>使用延时事件统计与分析指令进行测试，发送：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>latency doctor
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP2返回的数据还是<code>Blob String</code>格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$196</span>
Dave, no latency spike was observed during the lifetime of this Redis instance, not <span class="token keyword">in</span> the slightest bit. I honestly think you ought to sit down calmly, take a stress pill, and think things over.
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>RESP V3返回的数据采用了新的格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">=</span><span class="token number">200</span>
txt:Dave, no latency spike was observed during the lifetime of this Redis instance, not <span class="token keyword">in</span> the slightest bit. I honestly think you ought to sit down calmly, take a stress pill, and think things over.
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_6、big-number" tabindex="-1"><a class="header-anchor" href="#_6、big-number" aria-hidden="true">#</a> 6、Big number</h3><p><code>Big number</code>类型用于返回非常大的整数数字，可以表示在有符号64位数字范围内的整数，包括正数或负数，但是需要注意不能含有小数部分。数据格式为<code>(&lt;big number&gt;\\r\\n</code>，以左括号开头，示例如下：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token punctuation">(</span><span class="token number">3492890328409238509324850943850943825024385</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>注意，当<code>Big number</code>不可用时，客户端会返回一个字符串格式的数据。</p><h3 id="_7、aggregate-data-types" tabindex="-1"><a class="header-anchor" href="#_7、aggregate-data-types" aria-hidden="true">#</a> 7、Aggregate data types</h3><p>与前面我们介绍的给定数据类型的单个值不同，<code>Aggregate data types</code>可以理解为聚合数据类型。这也是RESP3的一个核心思想，要能够从协议和类型的角度，来描述不同语义的聚合数据类型。</p><p>聚合数据类型的格式如下，通常由聚合类型、元素个数以及具体的单一元素构成：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>&lt;aggregate-type-char&gt;&lt;numelements&gt;&lt;CR&gt;&lt;LF&gt;
... numelements other types ...
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>例如一个包含三个数字的数组<code>[1,2,3]</code>可以表示为：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*3
:1
:2
:3
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>当然聚合数据类型中的元素可以是其他聚合数据类型，例如在数组中也可以嵌套包含其他数组（下面的内容包含了缩进方便理解）：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*2
    *3
        :1
        <span class="token variable">$5</span>
        hello
        :2
    <span class="token comment">#f</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>上面的聚合数据类型所表示的数据为<code>[[1,&quot;hello&quot;,2],false]</code>。</p><h3 id="_8、map" tabindex="-1"><a class="header-anchor" href="#_8、map" aria-hidden="true">#</a> 8、Map</h3><p><code>Map</code>数据类型与数组比较类似，但是以<code>%</code>作为起始，后面是<code>Map</code>中键值对的数量，而不再是单个数据项的数量。它的数据内容是一个<strong>有序</strong>的键值对的数组，之后分行显示键值对的<code>key</code>和<code>value</code>，因此后面的数据行一定是偶数行。先看一下官方文档给出的例子，以下面的Json字符串为例：</p><div class="language-json line-numbers-mode" data-ext="json"><pre class="language-json"><code><span class="token punctuation">{</span>
    <span class="token property">&quot;first&quot;</span><span class="token operator">:</span><span class="token number">1</span><span class="token punctuation">,</span>
    <span class="token property">&quot;second&quot;</span><span class="token operator">:</span><span class="token number">2</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>转换为<code>Map</code>类型后格式为下面的形式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>%2
+first
:1
+second
:2
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>但是通过实验，Hydra发现了点有意思的东西，当我们发送一条<code>hgetall</code>的命令来请求哈希类型的数据时：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>hgetall user
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP V2返回的数据仍然使用老的<code>Array</code>格式，符合我们的预期：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*4
<span class="token variable">$4</span>
name
<span class="token variable">$5</span>
Hydra
<span class="token variable">$3</span>
age
<span class="token variable">$2</span>
<span class="token number">18</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>但是下面RESP3的数据返回却出乎我们的意料，可以看到虽然前面的<code>%2</code>表示使用了<code>Map</code>格式，但是后面并没有遵循官方文档给出的规范，除了开头的<code>%2</code>以外，其余部分与<code>Array</code>完全相同（）。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>%2
<span class="token variable">$4</span>
name
<span class="token variable">$5</span>
Hydra
<span class="token variable">$3</span>
age
<span class="token variable">$2</span>
<span class="token number">18</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>关于实际传输数据与文档中给出示例的出入，Hydra有一点自己的猜测，放在最后总结部分。</p><h3 id="_9、set" tabindex="-1"><a class="header-anchor" href="#_9、set" aria-hidden="true">#</a> 9、Set</h3><p><code>Set</code>与<code>Array</code>类型非常相似，但是它的第一个字节使用<code>~</code>替代了<code>*</code>，它是一个无序的数据集合。还是先看一下官方文档中给出的示例，下面是一个包含了5个元素的集合类型数据，并且其中具体的数据类型可以不同：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>~<span class="token operator"><span class="token file-descriptor important">5</span>&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
+orange<span class="token operator">&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
+apple<span class="token operator">&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
<span class="token comment">#t&lt;CR&gt;&lt;LF&gt;</span>
:10<span class="token operator"><span class="token file-descriptor important">0</span>&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
:99<span class="token operator"><span class="token file-descriptor important">9</span>&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>下面使用<code>SMEMBERS</code>命令获取集合中的所有元素进行测试：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>SMEMBERS  myset
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>RESP V2返回时仍然使用<code>Array</code>格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>*3
<span class="token variable">$1</span>
a
<span class="token variable">$1</span>
c
<span class="token variable">$1</span>
b
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>RESP3的数据返回情况和<code>Map</code>比较类似，使用<code>~</code>开头，但是没有完全遵从协议中的格式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>~3
<span class="token variable">$1</span>
a
<span class="token variable">$1</span>
c
<span class="token variable">$1</span>
b
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_10、attribute" tabindex="-1"><a class="header-anchor" href="#_10、attribute" aria-hidden="true">#</a> 10、Attribute</h3><p><code>Attribute</code>类型与<code>Map</code>类型非常相似，但是头一个字节使用<code>|</code>来代替了<code>%</code>，<code>Attribute</code>描述的数据内容比较像<code>Map</code>中的字典映射。客户端不应该将这个字典内容看做数据回复的一部分，而是当做增强回复内容的辅助数据。</p><p>在文档中提到，在未来某个版本的Redis中可能会出现这样一个功能，每次执行指令时都会打印访问的<code>key</code>的请求频率，这个值可能使用一个浮点数表示，那么在执行<code>MGET a b</code>时就可能会收到回复：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">|</span><span class="token number">1</span>
    +key-popularity
    %2
        <span class="token variable">$1</span>
        a
        ,0.1923
        <span class="token variable">$1</span>
        b
        ,0.0012
*2
    :2039123
    :9543892
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在上面的数据回复中，实际中回复的数据应该是<code>[2039123,9543892]</code>，但是在前面附加了它们请求的属性，当读到这个<code>Attribute</code>类型数据后，应当继续读取后面的实际数据。</p><h3 id="_11、push" tabindex="-1"><a class="header-anchor" href="#_11、push" aria-hidden="true">#</a> 11、Push</h3><p><code>Push</code>数据类型是一种服务器向客户端发送的异步数据，它的格式与<code>Array</code>类型比较类似，但是以<code>&gt;</code>开头，接下来的数组中的第一个数据为字符串类型，表示服务器发送给客户端的推送数据是何种类型。数组中其他的数据也都包含自己的类型，需要按照协议中类型规范进行解析。</p><p>简单看一下文档中给出的示例，在执行<code>get key</code>命令后，可能会得到两个有效回复：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span><span class="token number">4</span>
+pubsub
+message
+somechannel
+this is the message
<span class="token variable">$9</span>
Get-Reply
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在上面的这段回复中需要注意，收到的两个回复中第一个是推送数据的类型，第二个才是真正回复的数据内容。</p><p>注意！这里在文档中有一句提示：虽然下面的演示使用的是<code>Simple string</code>格式，但是在实际数据传输中使用的是<code>Blob string</code>格式。所以盲猜一波，上面的<code>Map</code>和<code>Set</code>也是同样的情况？</p><p>这里先简单铺垫一下<code>Push</code>回复类型在redis6中非常重要的一个使用场景<strong>客户端缓存</strong><code>client-side caching</code>，它允许将数据存储在本地应用中，当访问时不再需要访问redis服务端，但是其他客户端修改数据时需要通知当前客户端作废掉本地应用的客户端缓存，这时候就会用到<code>Push</code>类型的消息。</p><p>我们先在客户端A中执行下面的命令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>client tracking on
get key1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>在客户端B中执行：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token builtin class-name">set</span> key1 newValue
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>这时就会在客户端A中收到<code>Push</code>类型的消息，通知客户端缓存失效。在下面收到的消息中就包含了两部分，第一部分表示收到的消息类型为<code>invalidate</code>，第二部分则是需要作废的缓存<code>key1</code>：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span><span class="token number">2</span>
<span class="token variable">$10</span>
invalidate
*1
<span class="token variable">$4</span>
key1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_12、stream" tabindex="-1"><a class="header-anchor" href="#_12、stream" aria-hidden="true">#</a> 12、Stream</h3><p>在前面介绍的类型中，返回的数据字符串一般都具有指定的长度，例如下面这样：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$1234</span><span class="token operator">&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
<span class="token punctuation">..</span><span class="token punctuation">..</span> <span class="token number">1234</span> bytes of data here <span class="token punctuation">..</span>.<span class="token operator">&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>但是有时候需要将一段不知道长度的字符串数据从客户端传给服务器（或者反向传输）时，很明显这种格式无法使用，因此需要一种新的格式用来传送<strong>不确定长度</strong>的数据。</p><p>文档中提到，过去在服务端有一个私有扩展的数据格式，规范如下：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$EOF</span>:<span class="token operator">&lt;</span><span class="token number">40</span> bytes marker<span class="token operator">&gt;</span><span class="token operator">&lt;</span>CR<span class="token operator">&gt;</span><span class="token operator">&lt;</span>LF<span class="token operator">&gt;</span>
<span class="token punctuation">..</span>. any number of bytes of data here not containing the marker <span class="token punctuation">..</span>.
<span class="token operator">&lt;</span><span class="token number">40</span> bytes marker<span class="token operator">&gt;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>它以<code>$EOF:</code>作为起始字节，然后是40字节的<code>marker</code>标识符，在<code>\\r\\n</code>后跟随的是真正的数据，结束后也是40字节的标识符。标识符以伪随机的方式生成，基本上不会与正常的数据发生冲突。</p><p>但是这种格式存在一定的局限性，主要问题就在于生成标识符以及解析标识符上，由于一些原因使得上面这种格式在实际使用中非常脆弱。因此最终在规范中提出了一种<strong>分块编码格式</strong>，举一个简单的例子，当需要发送事先不知道长度的字符串<code>Hello world</code>时：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token variable">$?</span>
<span class="token punctuation">;</span><span class="token number">4</span>
Hell
<span class="token punctuation">;</span><span class="token number">5</span>
o wor
<span class="token punctuation">;</span><span class="token number">2</span>
ld
<span class="token punctuation">;</span><span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这种格式以<code>$?</code>开头，表示是一个不知道长度的分块编码格式，后面传输的数据数量没有限制，在最后以零长度的<code>;0</code>作为结束传输的标识。文档中提到，目前还没有命令会以这个格式来进行数据回复，但是会在后面的功能模块中实装这个协议。</p><h3 id="_13、hello" tabindex="-1"><a class="header-anchor" href="#_13、hello" aria-hidden="true">#</a> 13、HELLO</h3><p>在介绍RESP3的最开始，我们就在<code>telnet</code>中通过<code>hello 3</code>的命令来切换协议到V3版本。这个特殊的命令完成了两件事：</p><ul><li>它允许服务器与RESP V2版本向后兼容，也方便以后更加轻松的切换到RESP3</li><li><code>hello</code>命令可以返回有关服务器和协议的信息，以供客户端使用</li></ul><p><code>hello</code>命令的格式如下，可以看到除了协议版本号外，还可以指定用户名和密码：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>HELLO <span class="token operator">&lt;</span>protocol-version<span class="token operator">&gt;</span> <span class="token punctuation">[</span>AUTH <span class="token operator">&lt;</span>username<span class="token operator">&gt;</span> <span class="token operator">&lt;</span>password<span class="token operator">&gt;</span><span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p><code>hello</code>命令的返回结果是前面介绍过的<code>Map</code>类型，仅仅在客户端和服务器建立连接的时候发送。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>%7
<span class="token variable">$6</span>
server
<span class="token variable">$5</span>
redis
<span class="token variable">$7</span>
version
<span class="token variable">$6</span>
<span class="token number">6.0</span>.16
<span class="token variable">$5</span>
proto
:3
<span class="token variable">$2</span>
<span class="token function">id</span>
:18
<span class="token variable">$4</span>
mode
<span class="token variable">$10</span>
standalone
<span class="token variable">$4</span>
role
<span class="token variable">$6</span>
master
<span class="token variable">$7</span>
modules
*0
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>转换为我们可读的<code>Map</code>格式后，可以看到它返回的Redis服务端的一些信息：</p><div class="language-json line-numbers-mode" data-ext="json"><pre class="language-json"><code><span class="token punctuation">{</span>
    <span class="token property">&quot;server&quot;</span><span class="token operator">:</span><span class="token string">&quot;redis&quot;</span><span class="token punctuation">,</span>
    <span class="token property">&quot;version&quot;</span><span class="token operator">:</span><span class="token string">&quot;6.0.16&quot;</span><span class="token punctuation">,</span>
    <span class="token property">&quot;proto&quot;</span><span class="token operator">:</span><span class="token number">3</span><span class="token punctuation">,</span>
    <span class="token property">&quot;id&quot;</span><span class="token operator">:</span><span class="token number">18</span><span class="token punctuation">,</span>
    <span class="token property">&quot;mode&quot;</span><span class="token operator">:</span><span class="token string">&quot;standalone&quot;</span><span class="token punctuation">,</span>
    <span class="token property">&quot;role&quot;</span><span class="token operator">:</span><span class="token string">&quot;master&quot;</span><span class="token punctuation">,</span>
    <span class="token property">&quot;modules&quot;</span><span class="token operator">:</span><span class="token punctuation">[</span><span class="token punctuation">]</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="总结" tabindex="-1"><a class="header-anchor" href="#总结" aria-hidden="true">#</a> 总结</h2><p>在RESP V2中，通信协议还是比较简单，通信内容大多也都还是通过数组形式进行编码和发送，这种情况带来了很多不便，有很多情况需要根据操作命令的类型来判断返回的数据具体是什么类型，这无疑增加了客户端解析数据的难度与复杂度。</p><p>而在RESP3中，通过引入新的多种数据类型，通过起始字节的字符进行类型的区分编码，使客户端可以直接判断返回数据的类型，在相当大的程度上，减轻了解析的复杂度，提升了效率。</p><p>本文中对于新的返回数据类型，一部分给出了通信数据的示例，但还是有一些类型暂时没有找到合适的命令进行测试，有了解的小伙伴们可以给我补充。</p><p>另外对于<code>Map</code>和<code>Set</code>，实际传输的数据与官方文档给出的仍有一定出入，个人认为情况和<code>Push</code>相同，可能是官方文档中更多只偏向于演示，使用<code>Simple string</code>来代替了<code>Blob string</code>。</p><p>最后再啰嗦一句，说说协议的命名，新一代的协议名称就叫<code>RESP3</code>，而没有继承第二代的命名规范叫<code>RESP V3</code>，也不是<code>RESP version3</code>什么乱七八糟的，所以就不要纠结文中为啥一会是<code>RESP V2</code>，一会是<code>RESP3</code>这种不对称的命名了。</p><p>那么，这次的分享就到这里，我是Hydra，下篇文章再见。</p><p><strong>参考文档：</strong></p>`,155),v={href:"https://github.com/redis/redis-doc/blob/master/docs/reference/protocol-spec.md",target:"_blank",rel:"noopener noreferrer"},u={href:"https://github.com/antirez/RESP3/blob/master/spec.md",target:"_blank",rel:"noopener noreferrer"},b={href:"https://redis.io/docs/reference/protocol-spec/#high-performance-parser-for-the-redis-protocol",target:"_blank",rel:"noopener noreferrer"};function m(h,g){const a=o("ExternalLinkIcon");return d(),l("div",null,[r(" more "),p,e("blockquote",null,[e("p",null,[e("a",v,[s("https://github.com/redis/redis-doc/blob/master/docs/reference/protocol-spec.md"),n(a)])]),e("p",null,[e("a",u,[s("https://github.com/antirez/RESP3/blob/master/spec.md"),n(a)])]),e("p",null,[e("a",b,[s("https://redis.io/docs/reference/protocol-spec/#high-performance-parser-for-the-redis-protocol"),n(a)])])])])}const x=i(t,[["render",m],["__file","RESP3.html.vue"]]);export{x as default};
