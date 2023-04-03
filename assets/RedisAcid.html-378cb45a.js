import{_ as e,W as t,X as p,$ as c,Y as s,a0 as n,a1 as i,Z as o,C as l}from"./framework-9e67db09.js";const r={},d=o(`<p>谈起数据库的事务来，估计很多同学的第一反应都是<code>ACID</code>，而排在<code>ACID</code>中首位的<code>A</code>原子性，要求一个事务中的所有操作，要么全部完成，要么全部不完成。熟悉redis的同学肯定知道，在redis中也存在事务，那么它的事务也满足原子性吗？下面我们就来一探究竟。</p><h3 id="什么是redis事务" tabindex="-1"><a class="header-anchor" href="#什么是redis事务" aria-hidden="true">#</a> 什么是Redis事务？</h3><p>和数据库事务类似，redis事务也是用来一次性地执行多条命令。使用起来也很简单，可以用<code>MULTI</code>开启一个事务，然后将多个命令入队到事务的队列中，最后由<code>EXEC</code>命令触发事务，执行事务中的所有命令。看一个简单的事务执行例子：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> multi
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> name Hydra
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> age <span class="token number">18</span>
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> incr age
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">exec</span>
<span class="token number">1</span><span class="token punctuation">)</span> OK
<span class="token number">2</span><span class="token punctuation">)</span> OK
<span class="token number">3</span><span class="token punctuation">)</span> <span class="token punctuation">(</span>integer<span class="token punctuation">)</span> <span class="token number">19</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看到，在指令和操作数的数据类型等都正常的情况下，输入<code>EXEC</code>后所有命令被执行成功。</p><h3 id="redis事务满足原子性吗" tabindex="-1"><a class="header-anchor" href="#redis事务满足原子性吗" aria-hidden="true">#</a> Redis事务满足原子性吗？</h3><p>如果要验证redis事务是否满足原子性，那么需要在redis事务执行发生异常的情况下进行，下面我们分两种不同类型的错误分别测试。</p><h4 id="语法错误" tabindex="-1"><a class="header-anchor" href="#语法错误" aria-hidden="true">#</a> 语法错误</h4><p>首先测试命令中有语法错误的情况，这种情况多为命令的参数个数不正确或输入的命令本身存在错误。下面我们在事务中输入一个存在格式错误的命令，开启事务并依次输入下面的命令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> multi
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> name Hydra
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> incr
<span class="token punctuation">(</span>error<span class="token punctuation">)</span> ERR wrong number of arguments <span class="token keyword">for</span> <span class="token string">&#39;incr&#39;</span> <span class="token builtin class-name">command</span>
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> age <span class="token number">18</span>
QUEUED
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>输入的命令<code>incr</code>后面没有添加参数，属于命令格式不对的语法错误，这时在命令入队时就会立刻检测出错误并提示<code>error</code>。使用<code>exec</code>执行事务，查看结果输出：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">exec</span>
<span class="token punctuation">(</span>error<span class="token punctuation">)</span> EXECABORT Transaction discarded because of previous errors.
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>在这种情况下，只要事务中的一条命令有语法错误，在执行<code>exec</code>后就会直接返回错误，包括语法正确的命令在内的所有命令都不会被执行。对此进行验证，看一下在事务中其他指令执行情况，查看<code>set</code>命令的执行结果，全部为空，说明指令没有被执行。</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get name
<span class="token punctuation">(</span>nil<span class="token punctuation">)</span>
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get age
<span class="token punctuation">(</span>nil<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>此外，如果存在命令本身拼写错误、或输入了一个不存在的命令等情况，也属于语法错误的情况，执行事务时会直接报错。</p><h4 id="运行错误" tabindex="-1"><a class="header-anchor" href="#运行错误" aria-hidden="true">#</a> 运行错误</h4><p>运行错误是指输入的指令格式正确，但是在命令执行期间出现的错误，典型场景是当输入参数的数据类型不符合命令的参数要求时，就会发生运行错误。例如下面的例子中，对一个<code>string</code>类型的值执行列表的操作，报错如下：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> key1 value1
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> lpush key1 value2
<span class="token punctuation">(</span>error<span class="token punctuation">)</span> WRONGTYPE Operation against a key holding the wrong kind of value
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>这种错误在redis实际执行指令前是无法被发现的，只能当真正执行才能够被发现，因此这样的命令是可以被事务队列接收的，不会和上面的语法错误一样立即报错。</p><p>具体看一下当事务中存在运行错误的情况，在下面的事务中，尝试对<code>string</code>类型数据进行<code>incr</code>自增操作：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> multi
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> name Hydra
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">set</span> age eighteen
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> incr age
QUEUED
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> del name
QUEUED
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>redis一直到这里都没有提示存在错误，执行<code>exec</code>看一下结果输出：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">exec</span>
<span class="token number">1</span><span class="token punctuation">)</span> OK
<span class="token number">2</span><span class="token punctuation">)</span> OK
<span class="token number">3</span><span class="token punctuation">)</span> <span class="token punctuation">(</span>error<span class="token punctuation">)</span> ERR value is not an integer or out of range
<span class="token number">4</span><span class="token punctuation">)</span> <span class="token punctuation">(</span>integer<span class="token punctuation">)</span> <span class="token number">1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>运行结果可以看到，虽然<code>incr age</code>这条命令出现了错误，但是它前后的命令都正常执行了，再看一下这些<code>key</code>对应的值，确实证明了其余指令都执行成功：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get name
<span class="token punctuation">(</span>nil<span class="token punctuation">)</span>
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get age
<span class="token string">&quot;eighteen&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h4 id="阶段性结论" tabindex="-1"><a class="header-anchor" href="#阶段性结论" aria-hidden="true">#</a> 阶段性结论</h4><p>对上面的事务的运行结果进行一下分析：</p><ul><li>存在<strong>语法错误</strong>的情况下，所有命令都不会执行</li><li>存在<strong>运行错误</strong>的情况下，除执行中出现错误的命令外，其他命令都能正常执行</li></ul><p>通过分析我们知道了redis中的事务是不满足原子性的，在运行错误的情况下，并没有提供类似数据库中的回滚功能。那么为什么redis不支持回滚呢，官方文档给出了说明，大意如下：</p><ul><li>redis命令失败只会发生在语法错误或数据类型错误的情况，这一结果都是由编程过程中的错误导致，这种情况应该在开发环境中检测出来，而不是生产环境</li><li>不使用回滚，能使redis内部设计更简单，速度更快</li><li>回滚不能避免编程逻辑中的错误，如果想要将一个键的值增加2却只增加了1，这种情况即使提供回滚也无法提供帮助</li></ul><p>基于以上原因，redis官方选择了更简单、更快的方法，不支持错误回滚。这样的话，如果在我们的业务场景中需要保证原子性，那么就要求了开发者通过其他手段保证命令全部执行成功或失败，例如在执行命令前进行参数类型的校验，或在事务执行出现错误时及时做事务补偿。</p><p>提到其他方式，相信很多小伙伴都听说<strong>使用Lua脚本来保证操作的原子性</strong>，例如在分布式锁中通常使用的就是<code>Lua</code>脚本，那么，神奇的<code>Lua</code>脚本真的能保证原子性吗？</p><h3 id="简单的lua脚本入门" tabindex="-1"><a class="header-anchor" href="#简单的lua脚本入门" aria-hidden="true">#</a> 简单的Lua脚本入门</h3><p>在验证lua脚本的原子性之前，我们需要对它做一个简单的了解。redis从2.6版本开始支持执行lua脚本，它的功能和事务非常类似，一段lua脚本被视作一条命令执行，这样将多条redis命令写入lua，即可实现类似事务的执行结果。我们先看一下下面几个常用的命令。</p><h4 id="eval-命令" tabindex="-1"><a class="header-anchor" href="#eval-命令" aria-hidden="true">#</a> EVAL 命令</h4><p>最常用的<code>EVAL</code>用于执行一段脚本，它的命令的格式如下：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>EVAL script numkeys key <span class="token punctuation">[</span>key <span class="token punctuation">..</span>.<span class="token punctuation">]</span> arg <span class="token punctuation">[</span>arg <span class="token punctuation">..</span>.<span class="token punctuation">]</span> 
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>简单解释一下其中的参数：</p><ul><li><code>script</code>是一段lua脚本程序</li><li><code>numkeys</code>指定后续参数有几个<code>key</code>，如没有<code>key</code>则为0</li><li><code>key [key …]</code>表示脚本中用到的redis中的键，在lua脚本中通过<code>KEYS[i]</code>的形式获取</li><li><code>arg [arg …]</code>表示附加参数，在lua脚本中通过<code>ARGV[i]</code>获取</li></ul><p>看一个简单的例子：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">eval</span> <span class="token string">&quot;return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}&quot;</span> <span class="token number">2</span> key1 key2 value1 vauel2
<span class="token number">1</span><span class="token punctuation">)</span> <span class="token string">&quot;key1&quot;</span>
<span class="token number">2</span><span class="token punctuation">)</span> <span class="token string">&quot;key2&quot;</span>
<span class="token number">3</span><span class="token punctuation">)</span> <span class="token string">&quot;value1&quot;</span>
<span class="token number">4</span><span class="token punctuation">)</span> <span class="token string">&quot;vauel2&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>在上面的命令中，双引号中是lua脚本程序，后面的2表示存在两个key，分别是<code>key1</code>和<code>key2</code>，之后的参数是附加参数<code>value1</code>和<code>value2</code>。</p><p>如果想要使用lua脚本执行<code>set</code>命令，可以写成这样：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> EVAL <span class="token string">&quot;redis.call(&#39;SET&#39;, KEYS[1], ARGV[1]);&quot;</span> <span class="token number">1</span> name Hydra
<span class="token punctuation">(</span>nil<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>这里使用了redis内置的lua函数<code>redis.call</code>来完成<code>set</code>命令，这里打印的执行结果<code>nil</code>是因为没有返回值，如果不习惯的话，其实我们可以在脚本中添加<code>return 0;</code>的返回语句。</p><h4 id="script-load-和-evalsha命令" tabindex="-1"><a class="header-anchor" href="#script-load-和-evalsha命令" aria-hidden="true">#</a> SCRIPT LOAD 和 EVALSHA命令</h4><p>这两个命令放在一起是因为它们一般成对使用。先看<code>SCRIPT LOAD</code>，它用于把脚本加载到缓存中，返回<code>SHA1</code>校验和，这时候只是缓存了命令，但是命令没有被马上执行，看一个例子：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> SCRIPT LOAD <span class="token string">&quot;return redis.call(&#39;GET&#39;, KEYS[1]);&quot;</span>
<span class="token string">&quot;228d85f44a89b14a5cdb768a29c4c4d907133f56&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>这里返回了一个<code>SHA1</code>的校验和，接下来就可以使用<code>EVALSHA</code>来执行脚本了：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> EVALSHA <span class="token string">&quot;228d85f44a89b14a5cdb768a29c4c4d907133f56&quot;</span> <span class="token number">1</span> name
<span class="token string">&quot;Hydra&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>这里使用这个<code>SHA1</code>值就相当于导入了上面缓存的命令，在之后再拼接<code>numkeys</code>、<code>key</code>、<code>arg</code>等参数，命令就能够正常执行了。</p><h4 id="其他命令" tabindex="-1"><a class="header-anchor" href="#其他命令" aria-hidden="true">#</a> 其他命令</h4><p>使用<code>SCRIPT EXISTS</code>命令判断脚本是否被缓存：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> SCRIPT EXISTS 228d85f44a89b14a5cdb768a29c4c4d907133f56
<span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">(</span>integer<span class="token punctuation">)</span> <span class="token number">1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>使用<code>SCRIPT FLUSH</code>命令清除redis中的lua脚本缓存：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> SCRIPT FLUSH
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> SCRIPT EXISTS 228d85f44a89b14a5cdb768a29c4c4d907133f56
<span class="token number">1</span><span class="token punctuation">)</span> <span class="token punctuation">(</span>integer<span class="token punctuation">)</span> <span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>可以看到，执行了<code>SCRIPT FLUSH</code>后，再次通过<code>SHA1</code>值查看脚本时已经不存在。最后，还可以使用<code>SCRIPT KILL</code>命令杀死当前正在运行的 lua 脚本，但是只有当脚本没有执行写操作时才会生效。</p><p>从这些操作看来，lua脚本具有下面的优点：</p><ul><li>多次网络请求可以在一次请求中完成，减少网络开销，减少了网络延迟</li><li>客户端发送的脚本会存在redis中，其他客户端可以复用这一脚本，而不需要再重复编码完成相同的逻辑</li></ul><h4 id="java代码中使用lua脚本" tabindex="-1"><a class="header-anchor" href="#java代码中使用lua脚本" aria-hidden="true">#</a> Java代码中使用lua脚本</h4><p>在Java代码中可以使用Jedis中封装好的API来执行lua脚本，下面是一个使用Jedis执行lua脚本的例子：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">void</span> <span class="token function">main</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> args<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token class-name">Jedis</span> jedis <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Jedis</span><span class="token punctuation">(</span><span class="token string">&quot;127.0.0.1&quot;</span><span class="token punctuation">,</span> <span class="token number">6379</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">String</span> script<span class="token operator">=</span><span class="token string">&quot;redis.call(&#39;SET&#39;, KEYS[1], ARGV[1]);&quot;</span>
            <span class="token operator">+</span><span class="token string">&quot;return redis.call(&#39;GET&#39;, KEYS[1]);&quot;</span><span class="token punctuation">;</span>
    <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> keys<span class="token operator">=</span> <span class="token class-name">Arrays</span><span class="token punctuation">.</span><span class="token function">asList</span><span class="token punctuation">(</span><span class="token string">&quot;age&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> values<span class="token operator">=</span> <span class="token class-name">Arrays</span><span class="token punctuation">.</span><span class="token function">asList</span><span class="token punctuation">(</span><span class="token string">&quot;eighteen&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">Object</span> result <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">eval</span><span class="token punctuation">(</span>script<span class="token punctuation">,</span> keys<span class="token punctuation">,</span> values<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span>result<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>执行上面的代码，控制台打印了<code>get</code>命令返回的结果：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>eighteen
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>简单的铺垫完成后，我们来看一下lua脚本究竟能否实现回滚级别的原子性。对上面的代码进行改造，插入一条运行错误的命令：</p><div class="language-java line-numbers-mode" data-ext="java"><pre class="language-java"><code><span class="token keyword">public</span> <span class="token keyword">static</span> <span class="token keyword">void</span> <span class="token function">main</span><span class="token punctuation">(</span><span class="token class-name">String</span><span class="token punctuation">[</span><span class="token punctuation">]</span> args<span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token class-name">Jedis</span> jedis <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Jedis</span><span class="token punctuation">(</span><span class="token string">&quot;127.0.0.1&quot;</span><span class="token punctuation">,</span> <span class="token number">6379</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">String</span> script<span class="token operator">=</span><span class="token string">&quot;redis.call(&#39;SET&#39;, KEYS[1], ARGV[1]);&quot;</span>
            <span class="token operator">+</span><span class="token string">&quot;redis.call(&#39;INCR&#39;, KEYS[1]);&quot;</span>
            <span class="token operator">+</span><span class="token string">&quot;return redis.call(&#39;GET&#39;, KEYS[1]);&quot;</span><span class="token punctuation">;</span>
    <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> keys<span class="token operator">=</span> <span class="token class-name">Arrays</span><span class="token punctuation">.</span><span class="token function">asList</span><span class="token punctuation">(</span><span class="token string">&quot;age&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">List</span><span class="token generics"><span class="token punctuation">&lt;</span><span class="token class-name">String</span><span class="token punctuation">&gt;</span></span> values<span class="token operator">=</span> <span class="token class-name">Arrays</span><span class="token punctuation">.</span><span class="token function">asList</span><span class="token punctuation">(</span><span class="token string">&quot;eighteen&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">Object</span> result <span class="token operator">=</span> jedis<span class="token punctuation">.</span><span class="token function">eval</span><span class="token punctuation">(</span>script<span class="token punctuation">,</span> keys<span class="token punctuation">,</span> values<span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token class-name">System</span><span class="token punctuation">.</span>out<span class="token punctuation">.</span><span class="token function">println</span><span class="token punctuation">(</span>result<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>查看执行结果：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df545db3c0914554b771f3217768a47f~tplv-k3u1fbpfcp-zoom-1.image" alt="" tabindex="0" loading="lazy"><figcaption></figcaption></figure><p>再到客户端执行一下get命令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get age
<span class="token string">&quot;eighteen&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>也就是说，虽然程序抛出了异常，但异常前的命令还是被正常的执行了且没有被回滚。再试试直接在redis客户端中运行这条指令：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> flushall
OK
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> <span class="token builtin class-name">eval</span> <span class="token string">&quot;redis.call(&#39;SET&#39;, KEYS[1], ARGV[1]);redis.call(&#39;INCR&#39;, KEYS[1]);return redis.call(&#39;GET&#39;, KEYS[1])&quot;</span> <span class="token number">1</span> age eight
<span class="token punctuation">(</span>error<span class="token punctuation">)</span> ERR Error running script <span class="token punctuation">(</span>call to f_c2ea9d5c8f60735ecbedb47efd42c834554b9b3b<span class="token punctuation">)</span>: @user_script:1: ERR value is not an integer or out of range
<span class="token number">127.0</span>.0.1:637<span class="token operator"><span class="token file-descriptor important">9</span>&gt;</span> get age
<span class="token string">&quot;eight&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>同样，错误之前的指令仍然没有被回滚，那么我们之前经常听说的<code>Lua</code>脚本保证原子性操作究竟是怎么回事呢？</p><p>其实，在redis中是使用的同一个lua解释器来执行所有命令，也就保证了当一段lua脚本在执行时，不会有其他脚本或redis命令同时执行，保证了操作不会被其他指令插入或打扰，实现的仅仅是这种程度上的原子性。</p><p>但是遗憾的是，如果脚本运行时出错并中途结束，之后的操作不会进行，但是之前已经发生的写操作不会撤销，所以即使使用了lua脚本，也不能实现类似数据库回滚的原子性。</p>`,75),u=s("p",null,"本文基于redis 5.0.3 进行测试",-1),k={href:"https://redis.io/topics/transactions",target:"_blank",rel:"noopener noreferrer"};function m(v,b){const a=l("ExternalLinkIcon");return t(),p("div",null,[c(" more "),d,s("blockquote",null,[u,s("p",null,[n("官方文档相关说明："),s("a",k,[n("https://redis.io/topics/transactions"),i(a)])])])])}const h=e(r,[["render",m],["__file","RedisAcid.html.vue"]]);export{h as default};
