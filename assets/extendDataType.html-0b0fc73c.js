import{_ as n,W as s,X as a,$ as e,Z as t}from"./framework-9e67db09.js";const p={},i=t(`<p>在Redis中有5种基本数据类型，分别是String, List, Hash, Set, Zset。除此之外，Redis中还有一些实用性很高的扩展数据类型，下面来介绍一下这些扩展数据类型以及它们的使用场景。</p><h3 id="geo" tabindex="-1"><a class="header-anchor" href="#geo" aria-hidden="true">#</a> Geo</h3><p>GEO在Redis 3.2版本后被添加，可以说是针对<code>LBS（Location-Based Service）</code>产生的一种数据类型，主要用于存储地理位置信息，并可以对存储的信息进行一系列的计算操作。</p><p><code>geoadd</code>：存储指定的地理空间位置：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GEOADD key longitude latitude member <span class="token punctuation">[</span>longitude latitude member <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GEOADD locations <span class="token number">116.419217</span> <span class="token number">39.921133</span> beijing
<span class="token operator">&gt;</span> GEOADD locations <span class="token number">120.369557</span> <span class="token number">36.094406</span> qingdao
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>来看一下geo数据在Redis中的存储方式，可以看到是以zset格式进行存储的，因此geo是zset的一个扩展：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b99f9dd64a6841838edad1e9d909ba9a~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p><code>geopos</code>：返回指定地理位置的经纬度坐标：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GEOPOS key member <span class="token punctuation">[</span>member <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GEOPOS locations beijing qingdao 
<span class="token number">116.41921967267990112</span>
<span class="token number">39.92113206197632991</span>
<span class="token number">120.36955565214157104</span>
<span class="token number">36.09440522913565275</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>也可以使用<code>zrange</code>返回所有的位置元素而不带经纬度信息：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> ZRANGE locations <span class="token number">0</span> <span class="token parameter variable">-1</span>
qingdao
beijing
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>geodist</code>：计算指定位置间的距离，并可以指定返回的距离单位：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GEODIST key member1 member2 <span class="token punctuation">[</span>m<span class="token operator">|</span>km<span class="token operator">|</span>ft<span class="token operator">|</span>mi<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GEODIST locations beijing qingdao km
<span class="token number">548.5196</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>georadiusbymember</code>：找出以给定位置为中心，返回key包含的元素中，与中心的距离不超过给定最大距离的所有位置元素：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GEORADIUSBYMEMBER key member radius <span class="token punctuation">[</span>m<span class="token operator">|</span>km<span class="token operator">|</span>ft<span class="token operator">|</span>mi<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GEORADIUSBYMEMBER locations beijing <span class="token number">150</span> km
beijing
<span class="token comment"># 扩大范围</span>
<span class="token operator">&gt;</span> GEORADIUSBYMEMBER locations beijing <span class="token number">600</span> km
qingdao
beijing
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>georadius</code>与<code>georadiusbymember</code>类似，不过是以指定的经纬度为中心：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GEORADIUS key longitude latitude radius <span class="token punctuation">[</span>m<span class="token operator">|</span>km<span class="token operator">|</span>ft<span class="token operator">|</span>mi<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GEORADIUS  locations  <span class="token number">116.4192</span> <span class="token number">39.9211</span> <span class="token number">10</span> km
beijing
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>geo并没有提供删除指令，但根据其底层是zset实现，我们可以使用<code>zrem</code>对数据进行删除：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> ZREM locations beijing
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>基于geo，可以很简单的存储人或物关联的经纬度信息，并对这些地理信息进行处理，例如基于查询相邻的经纬度范围，能简单实现类似“附近的人”等功能。</p><h3 id="bitmap" tabindex="-1"><a class="header-anchor" href="#bitmap" aria-hidden="true">#</a> Bitmap</h3><p>Bitmap 也被称为位图，是以 String 类型作为底层数据结构实现的一种统计二值状态的数据类型。其中每一个bit都只能是0或1，所以通常用来表示一个对应于数组下标的数据是否存在。Bitmap 提供了一系列api，主要用于对 bit 位进行读写、计算、统计等操作。</p><p><code>setbit</code>：对key所存储的字符串值，设置或清除指定偏移量上的位（bit）:</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
SETBIT key offset value
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> SETBIT key <span class="token number">100</span> <span class="token number">1</span>
<span class="token operator">&gt;</span> SETBIT key <span class="token number">128</span> <span class="token number">1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>getbit</code>：对key所存储的字符串值，获取指定偏移量上的位（bit）:</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
GETBIT key offset
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> GETBIT key <span class="token number">100</span>
<span class="token number">1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>bitcount</code>：可以统计bit 数组中指定范围内所有 <code>1</code> 的个数，如果不指定范围，则获取所有:</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
BITCOUNT key <span class="token punctuation">[</span>start end<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> BITCOUNT key
<span class="token number">2</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>bitpos</code>：计算 bit 数组中指定范围第一个偏移量对应的的值等于<code>targetBit</code>的位置：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
BITPOS key tartgetBit <span class="token punctuation">[</span>start end<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> BITPOS key <span class="token number">1</span>
<span class="token number">100</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>bitop</code>：做多个bit 数组的and（交集）、or（并集）、not（非）、xor（异或）。例如对key和key2做交集操作，并将结果保存在key:and:key2中：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
BITOP <span class="token function">op</span> destKey key1 <span class="token punctuation">[</span>key2<span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> BITOP and key:and:key2 key key2
<span class="token number">17</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Bitmap底层使用String实现，value的值最大能存储512M字节，可以表示 512 * 1024 * 1024*8=4294967296个位，已经能够满足我们绝大部分的使用场景。再看一下底层存储数据的格式，以刚刚存储的key为例：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x08\\x00\\x00\\x00\\x80
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>将16进制的数据转化为2进制数据，如下图所示，第100位和第128位为1，其他为0：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99be165f34c44486bf902b4fa5d087c7~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>此外，由于Redis在存储string类型的时候存储形式为二进制，所以也可以通过操作bit位来对string类型进行操作，在下面的例子中，通过直接操作bit，将string类型的abc变成了bbc。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> <span class="token builtin class-name">set</span> key2 abc
<span class="token operator">&gt;</span> setbit key2 <span class="token number">6</span> <span class="token number">1</span>
<span class="token operator">&gt;</span> setbit key2 <span class="token number">7</span> <span class="token number">0</span>
<span class="token operator">&gt;</span> get key2
bbc
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>另外，可以通过<code>bitfield</code>命令实现类似的效果：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> <span class="token builtin class-name">set</span> key3 a
<span class="token operator">&gt;</span> BITFIELD key3 get u8 <span class="token number">0</span>
<span class="token number">97</span>
<span class="token operator">&gt;</span> BITFIELD key3 <span class="token builtin class-name">set</span> u8 <span class="token number">0</span> <span class="token number">98</span>
<span class="token number">97</span>
<span class="token operator">&gt;</span> get key3
b
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>使用<code>bitfield</code> 命令可以返回指定位域的bit值，并将它转化为整形，有符号整型需在位数前加 <code>i</code>，无符号在位数前加<code>u</code>。上面我们将8位转化为无符号整形，正好是a的<code>ASCII</code>码，再对<code>ASCII</code>码进行修改，可以直接改变字符串的值。</p><p>Bitmap的应用非常广泛，例如在缓存三大问题中我们介绍过使用Bitmap作为布隆过滤器应对缓存穿透的问题，此外布隆过滤器也被广泛用于邮件系统中拦截垃圾邮件的地址。另外，常用的用户签到、朋友圈点赞等功能也可以用它来实现。</p><p>以实现用户签到功能为例，可以将每个用户按月存储为一条数据，key的格式可以定义为 <code>sign:userId:yyyyMM</code> ，如果签到了就将对应的位置改为1，未签到为0，这样最多只需要31个bit位就可以存储一个月的数据，转换为字节的话也只要4个字节就已经足够。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 1月10日签到，因为offset从0起始，所以将天数减1</span>
<span class="token operator">&gt;</span> SETBIT sign:6666:202101 <span class="token number">9</span> <span class="token number">1</span>
<span class="token number">0</span>
<span class="token comment"># 查看1月10日是否签到</span>
<span class="token operator">&gt;</span> GETBIT sign:6666:202101 <span class="token number">9</span>
<span class="token number">1</span>
<span class="token comment"># 统计签到天数</span>
<span class="token operator">&gt;</span> BITCOUNT  sign:6666:202101
<span class="token number">1</span>
<span class="token comment"># 查看首次签到的日期</span>
<span class="token operator">&gt;</span> BITPOS  sign:6666:202101 <span class="token number">1</span>
<span class="token number">9</span>
<span class="token comment"># 提取整月的签到数据</span>
<span class="token operator">&gt;</span> BITFIELD  sign:6666:202101 get u31 <span class="token number">0</span>
<span class="token number">2097152</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>注意在使用<code>bitfield</code>指令时，有符号整型最大支持64位，而无符号整型最大支持63位。如果位数超过限制，会报如下错误：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> bitfield key3 get u64 <span class="token number">0</span>
ERR Invalid bitfield type. Use something like i16 u8. Note that u64 is not supported but i64 is.
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>所以在存储签到数据时，如果按月存储的话在之后提取数据时会比较方便，如果按年存储数据，在提取整年的签到数据时可能需要进行分段。</p><h3 id="hyperloglog" tabindex="-1"><a class="header-anchor" href="#hyperloglog" aria-hidden="true">#</a> HyperLogLog</h3><p>Redis 在 2.8.9 版本添加了 HyperLogLog 结构，它是一种用于基数统计的数据集合类型。它的最大优势就在于，当集合元素数量非常多时，它计算基数所需的空间总是固定的，而且还很小。</p><p><code>pfadd</code>：向HyperLogLog中添加数据：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
PFADD key element <span class="token punctuation">[</span>element <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> PFADD index.html  uuid1 uuid2 uuid3 uuid4
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>pfcount</code>：返回HyperLogLog的基数统计结果：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
PFCOUNT key <span class="token punctuation">[</span>key <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> PFCOUNT index.html
<span class="token number">4</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>pfmerge</code>：将多个 HyperLogLog 合并为一个 HyperLogLog ，合并后的 HyperLogLog 的基数估算值是通过对所有 给定 HyperLogLog 进行并集计算得出的。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
PFMERGE destkey sourcekey <span class="token punctuation">[</span>sourcekey <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> PFMERGE index.html home.html
OK
<span class="token operator">&gt;</span> PFCOUNT index.html
<span class="token number">6</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>例如在上面的例子中，使用HyperLogLog 可以很方便的统计网页的UV。在官方文档中指明，Redis 中每个 HyperLogLog 只需要花费 12 KB 内存，就可以对 2^64 个数据完成基数统计。尽管使用Set或Hash等结构也能实现基数统计，但这些数据结构都会消耗大量的内存。而使用HyperLogLog 时，和其他数据结构计算基数时，元素越多耗费内存就越多形成了鲜明对比。</p><p>需要注意的是，HyperLogLog是一种算法，并非是Redis独有的，并且HyperLogLog 的统计规则是基于概率完成的，所以它给出的统计结果是有一定误差的，官方给出的标准误算率是 0.81%。 HyperLogLog 只会根据输入元素来计算基数，而不会存储输入的元素本身，所以 HyperLogLog 不能像集合那样，返回输入的各个元素。</p><p>针对以上这些特性，可以总结出，HyperLogLog适用于大数据量的基数统计，但是它也存在局限性，它只能够实现统计基数的数量，但无法知道具体的原数据是什么。如果需要原数据的话，我们可以将 Bitmap 和 HyperLogLog 配合使用，例如在统计网站UV时，使用Bitmap 标识哪些用户属于活跃用户，使用 HyperLogLog 实现基数统计。</p><h3 id="stream" tabindex="-1"><a class="header-anchor" href="#stream" aria-hidden="true">#</a> Stream</h3><p>Stream是Redis 5.0版本之后新增加的数据结构，实现了消息队列的功能，并且实现消息的持久化和主备复制功能，可以让任何客户端访问任何时刻的数据，并且能记住每一个客户端的访问位置，保证消息不丢失，下面我们看一下具体的指令。</p><p><code>xadd</code>：向队列添加消息</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
XADD key ID field value <span class="token punctuation">[</span>field value <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> XADD stream1 *  phone <span class="token number">88888888</span>  name Hydra
<span class="token string">&quot;1614316213565-0&quot;</span>
<span class="token operator">&gt;</span> XADD stream1 *  key1 value1 key2 value2 key3 value3
<span class="token string">&quot;1614317444558-0&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>添加消息是生成的 <code>1614316213565-0</code>，是生成消息的id，由时间戳加序号组成，时间戳是Redis的服务器时间，如果在同一个时间戳内，序号会递增来标识不同的消息。并且为了保证消息的有序性，生成的消息id是保持自增的。可以使用可视化工具查看数据，消息是以json格式被存储：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/31b4bb1d95a049629d93e20142b931e9~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>这里因为是不同时间戳，所以序号都是从0开始。我们可以通过redis的事务添加消息进行测试：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> MULTI
<span class="token string">&quot;OK&quot;</span>
<span class="token operator">&gt;</span> XADD stream * msg <span class="token number">1</span>
<span class="token string">&quot;QUEUED&quot;</span>
<span class="token operator">&gt;</span> XADD stream * msg <span class="token number">2</span>
<span class="token string">&quot;QUEUED&quot;</span>
<span class="token operator">&gt;</span> XADD stream * msg <span class="token number">3</span>
<span class="token string">&quot;QUEUED&quot;</span>
<span class="token operator">&gt;</span> XADD stream * msg <span class="token number">4</span>
<span class="token string">&quot;QUEUED&quot;</span>
<span class="token operator">&gt;</span> XADD stream * msg <span class="token number">5</span>
<span class="token string">&quot;QUEUED&quot;</span>
<span class="token operator">&gt;</span> EXEC
 <span class="token number">1</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
 <span class="token number">2</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614319042782-0&quot;</span>
 <span class="token number">3</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
 <span class="token number">4</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614319042782-1&quot;</span>
 <span class="token number">5</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
 <span class="token number">6</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614319042782-2&quot;</span>
 <span class="token number">7</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
 <span class="token number">8</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614319042782-3&quot;</span>
 <span class="token number">9</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
 <span class="token number">10</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614319042782-4&quot;</span>
 <span class="token number">11</span><span class="token punctuation">)</span>  <span class="token string">&quot;OK&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>通过上面的例子，可以看见同一时间戳内，序号会不断递增。</p><p><code>xrange</code>：获取消息列表，会自动过滤删除的消息</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
XRANGE key start end <span class="token punctuation">[</span>COUNT count<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> XRANGE stream1 - +  count <span class="token number">5</span>
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;1614316213565-0&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token string">&quot;phone&quot;</span>
   <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token string">&quot;88888888&quot;</span>
   <span class="token number">3</span><span class="token punctuation">)</span>    <span class="token string">&quot;name&quot;</span>
   <span class="token number">4</span><span class="token punctuation">)</span>    <span class="token string">&quot;Hydra&quot;</span>
 <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;1614317444558-0&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token string">&quot;key1&quot;</span>
   <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token string">&quot;value1&quot;</span>
   <span class="token number">3</span><span class="token punctuation">)</span>    <span class="token string">&quot;key2&quot;</span>
   <span class="token number">4</span><span class="token punctuation">)</span>    <span class="token string">&quot;value2&quot;</span>
   <span class="token number">5</span><span class="token punctuation">)</span>    <span class="token string">&quot;key3&quot;</span>
   <span class="token number">6</span><span class="token punctuation">)</span>    <span class="token string">&quot;value3&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>xread</code>：以阻塞或非阻塞方式获取消息列表</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
XREAD <span class="token punctuation">[</span>COUNT count<span class="token punctuation">]</span> <span class="token punctuation">[</span>BLOCK milliseconds<span class="token punctuation">]</span> STREAMS key <span class="token punctuation">[</span>key <span class="token punctuation">..</span>.<span class="token punctuation">]</span> <span class="token function">id</span> <span class="token punctuation">[</span>id <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> XREAD count <span class="token number">1</span> STREAMS stream1 <span class="token number">0</span>-1
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;stream1&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>        <span class="token number">1</span><span class="token punctuation">)</span>     <span class="token string">&quot;1614316213565-0&quot;</span>
    <span class="token number">2</span><span class="token punctuation">)</span>          <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token string">&quot;phone&quot;</span>
     <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token string">&quot;88888888&quot;</span>
     <span class="token number">3</span><span class="token punctuation">)</span>      <span class="token string">&quot;name&quot;</span>
     <span class="token number">4</span><span class="token punctuation">)</span>      <span class="token string">&quot;Hydra&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>xdel</code>：删除消息</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
XDEL key ID <span class="token punctuation">[</span>ID <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
<span class="token comment"># 测试：</span>
<span class="token operator">&gt;</span> XDEL stream1 <span class="token number">1614317444558</span>-0
<span class="token string">&quot;1&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>除了上面消息队列的基本操作外，还可以创建消费者组对消息进行消费。首先使用<code>xgroup create</code> 创建消费者组：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式：</span>
XGROUP <span class="token punctuation">[</span>CREATE key groupname id-or-$<span class="token punctuation">]</span> <span class="token punctuation">[</span>SETID key groupname id-or-$<span class="token punctuation">]</span> <span class="token punctuation">[</span>DESTROY key groupname<span class="token punctuation">]</span> <span class="token punctuation">[</span>DELCONSUMER key groupname consumername<span class="token punctuation">]</span>
<span class="token comment"># 创建一个队列，从头开始消费：</span>
<span class="token operator">&gt;</span> XGROUP CREATE stream1 consumer-group-1 <span class="token number">0</span>-0  
<span class="token comment"># 创建一个队列，从尾部开始消费，只接收新消息：</span>
<span class="token operator">&gt;</span> XGROUP CREATE stream1 consumer-group-2 $  
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>下面使用消费者组消费消息：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 语法格式</span>
XREADGROUP GROUP group consumer <span class="token punctuation">[</span>COUNT count<span class="token punctuation">]</span> <span class="token punctuation">[</span>BLOCK milliseconds<span class="token punctuation">]</span> <span class="token punctuation">[</span>NOACK<span class="token punctuation">]</span> STREAMS key <span class="token punctuation">[</span>key <span class="token punctuation">..</span>.<span class="token punctuation">]</span> ID <span class="token punctuation">[</span>ID <span class="token punctuation">..</span>.<span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>注意这里消费消息的对象是 <code>consumer</code>消费者，而不是消费者组。在消费消息时，不需要预先创建消费者，在消费过程中直接指定就可以。接下来再向stream中发送一条消息，比较两个消费者组的消费顺序差异：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment"># 重新发送一条消息</span>
<span class="token operator">&gt;</span> XADD stream1 * newmsg hi
<span class="token string">&quot;1614318022661-0&quot;</span>
<span class="token comment"># 使用消费者组1消费：</span>
<span class="token operator">&gt;</span> XREADGROUP GROUP consumer-group-1 consumer1 COUNT <span class="token number">1</span> STREAMS stream1 <span class="token operator">&gt;</span>
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;stream1&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>        <span class="token number">1</span><span class="token punctuation">)</span>     <span class="token string">&quot;1614316213565-0&quot;</span>
    <span class="token number">2</span><span class="token punctuation">)</span>          <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token string">&quot;phone&quot;</span>
     <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token string">&quot;88888888&quot;</span>
     <span class="token number">3</span><span class="token punctuation">)</span>      <span class="token string">&quot;name&quot;</span>
     <span class="token number">4</span><span class="token punctuation">)</span>      <span class="token string">&quot;Hydra&quot;</span>
<span class="token comment"># 使用消费者组2消费：</span>
<span class="token operator">&gt;</span> XREADGROUP GROUP consumer-group-2 consumer2 COUNT <span class="token number">1</span> STREAMS stream1 <span class="token operator">&gt;</span>
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;stream1&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>        <span class="token number">1</span><span class="token punctuation">)</span>     <span class="token string">&quot;1614318022661-0&quot;</span>
    <span class="token number">2</span><span class="token punctuation">)</span>          <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token string">&quot;newmsg&quot;</span>
     <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token string">&quot;hi&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看到，消费者组1从stream的头部开始消费，而消费者组2从创建消费者组后的最新消息开始消费。在消费者组2内使用新的消费者再次进行消费：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> XREADGROUP GROUP consumer-group-2 consumer4 COUNT <span class="token number">1</span> STREAMS stream1 <span class="token operator">&gt;</span>

<span class="token operator">&gt;</span> XADD stream1 * newmsg2 hi2
<span class="token string">&quot;1614318706162-0&quot;</span>
<span class="token operator">&gt;</span> XREADGROUP GROUP consumer-group-2 consumer4 COUNT <span class="token number">1</span> STREAMS stream1 <span class="token operator">&gt;</span>
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;stream1&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>        <span class="token number">1</span><span class="token punctuation">)</span>     <span class="token string">&quot;1614318706162-0&quot;</span>
    <span class="token number">2</span><span class="token punctuation">)</span>          <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token string">&quot;newmsg2&quot;</span>
     <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token string">&quot;hi2&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在上面的例子中，可以看到在一个消费者组中，存在互斥原则，即一条消息被一个消费者消费过后，其他消费者就不能再消费这条消息了。</p><p><code>xpending</code>：等待列表用于记录读取但并未处理完毕的消息，可以使用它来获取未处理完毕的消息。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> XPENDING stream1 consumer-group-2
 <span class="token number">1</span><span class="token punctuation">)</span>  <span class="token string">&quot;2&quot;</span>  <span class="token comment"># 2条已读取但未处理的消息</span>
 <span class="token number">2</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614318022661-0&quot;</span>  <span class="token comment"># 起始消息ID</span>
 <span class="token number">3</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614318706162-0&quot;</span>  <span class="token comment"># 结束消息ID</span>
 <span class="token number">4</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token string">&quot;consumer2&quot;</span>   <span class="token comment"># 消费者2有1个</span>
   <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token string">&quot;1&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token string">&quot;consumer4&quot;</span>       <span class="token comment"># 消费者4有1个</span>
   <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token string">&quot;1&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在 <code>xpending</code> 命令后添加<code>start end count</code>参数可以获取详细信息：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> XPENDING stream1 consumer-group-2 - + <span class="token number">10</span>
 <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;1614318022661-0&quot;</span>  <span class="token comment"># 消息ID</span>
  <span class="token number">2</span><span class="token punctuation">)</span>   <span class="token string">&quot;consumer2&quot;</span>   <span class="token comment"># 消费者</span>
  <span class="token number">3</span><span class="token punctuation">)</span>   <span class="token string">&quot;1867692&quot;</span>    <span class="token comment"># 从读取到现在经历的毫秒数</span>
  <span class="token number">4</span><span class="token punctuation">)</span>   <span class="token string">&quot;1&quot;</span>		<span class="token comment">#消息被读取次数</span>
 <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>   <span class="token string">&quot;1614318706162-0&quot;</span>
  <span class="token number">2</span><span class="token punctuation">)</span>   <span class="token string">&quot;consumer4&quot;</span>
  <span class="token number">3</span><span class="token punctuation">)</span>   <span class="token string">&quot;1380323&quot;</span>
  <span class="token number">4</span><span class="token punctuation">)</span>   <span class="token string">&quot;1&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><code>xack</code>：告知消息被处理完成，移出pending列表</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> XACK stream1 consumer-group-2  <span class="token number">1614318022661</span>-0 
<span class="token string">&quot;1&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>再次查看pending列表，可以看到<code>1614318022661-0</code> 已被移除：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token operator">&gt;</span> XPENDING stream1 consumer-group-2 
 <span class="token number">1</span><span class="token punctuation">)</span>  <span class="token string">&quot;1&quot;</span>
 <span class="token number">2</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614318706162-0&quot;</span>
 <span class="token number">3</span><span class="token punctuation">)</span>  <span class="token string">&quot;1614318706162-0&quot;</span>
 <span class="token number">4</span><span class="token punctuation">)</span>    <span class="token number">1</span><span class="token punctuation">)</span>      <span class="token number">1</span><span class="token punctuation">)</span>    <span class="token string">&quot;consumer4&quot;</span>
   <span class="token number">2</span><span class="token punctuation">)</span>    <span class="token string">&quot;1&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>基于以上功能，如果我们的系统中已经使用了redis，甚至可以移除掉不需要的其他消息队列中间件，来达到精简应用系统的目的。并且，Redis Stream提供了消息的持久化和主从复制，能够很好的保证消息的可靠性。</p>`,91);function o(c,l){return s(),a("div",null,[e(" more "),i])}const d=n(p,[["render",o],["__file","extendDataType.html.vue"]]);export{d as default};
