import{_ as e,W as a,X as s,$ as i,Z as n}from"./framework-9e67db09.js";const d={},l=n(`<p>Redis虽然拥有非常高的性能，但是在实际的生产环境中，使用单机模式还是会产生不少问题的，比如说容易出现单机故障，容量瓶颈，以及QPS瓶颈等问题。通常环境下，主从复制、哨兵模式、Redis Cluster是3种比较常见的解决方案，本文将通过实例演示如何搭建Redis主从复制环境，并对其原理进行分析。</p><h4 id="一、搭建主从复制架构" tabindex="-1"><a class="header-anchor" href="#一、搭建主从复制架构" aria-hidden="true">#</a> 一、搭建主从复制架构</h4><p>1、创建3个目录redis8000，redis8001，redis8002目录下。将默认配置文件redis.conf拷贝到redis8000下，将redis8000指定为主机，修改以下参数:</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token builtin class-name">bind</span> <span class="token number">0.0</span>.0.0
port <span class="token number">8000</span>
pidfile /var/run/redis_8000.pid
logfile <span class="token string">&quot;redis8000.log&quot;</span>
<span class="token comment">#节省性能，关闭rdb持久化，注释以下配置</span>
<span class="token comment">#save 900 1</span>
<span class="token comment">#save 300 10</span>
<span class="token comment">#save 60 10000</span>
dbfilename dump8000.rdb
<span class="token function">dir</span> /home/hydra/files/redis/slave/redis8000/
requirepass <span class="token number">123456</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>2、将修改后的redis.conf文件拷贝到redis8001和redis8002目录下，首先批量替换配置文件中的8000端口为自己的端口：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>%s/8000/8001/g
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>修改配置文件：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>replicaof <span class="token number">127.0</span>.0.1 <span class="token number">8000</span>
masterauth <span class="token number">123456</span>
<span class="token comment">#从机开启aof持久化</span>
appendonly <span class="token function">yes</span> 
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>3、分别启动3个redis实例</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>./redis-5.0.4/src/redis-server  ./slave/redis8000/redis.conf
./redis-5.0.4/src/redis-server  ./slave/redis8001/redis.conf
./redis-5.0.4/src/redis-server  ./slave/redis8002/redis.conf
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>查看进程，启动成功：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d9ff1fe8f4804d40b5a5a1b5525c9ea6~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>4、通过redis客户端连接主机redis8000：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>./redis-5.0.4/src/redis-cli  <span class="token parameter variable">-p</span> <span class="token number">8000</span> <span class="token parameter variable">-a</span> <span class="token number">123456</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>登录成功后，使用指令查看主从架构：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>info replication
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8ae0919e0bd34662bcd46d17e5e2d92d~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>可以看出，主机8000拥有两台从机，从机8001和8002连接成功。</p><p>5、通过redis客户端连接从机redis80001，同样通过指令查看主从状态：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4250b23407154dd1bbd170ee2dade3a3~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>可以看出8001的角色为slave从机，并且可以查看主机8001的相关信息。</p><p>6、此外，还可以通过指令的模式动态分配主从。复制一个redis8000的配置文件至redis8003下，修改端口为8003，其他配置不做改动。使用redis客户端登录8003后，输入指令指定主机：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>slaveof <span class="token number">127.0</span>.0.1 <span class="token number">8000</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>动态指定主机后，如果主机设置了密码，还需要通过指令配置主机密码：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>config <span class="token builtin class-name">set</span> masterauth <span class="token number">123456</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>配置完成后，查看8003从机状态：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c1e61b750994f0a9a89d7fcb38c124f~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>查看8000主机状态：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9757430b2e82450eaf035627aedb2787~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>新添加的从机8003已经被添加到8000的从机当中。</p><p>需要注意的是，使用命令动态指定的主从状态，在从机重启后会失效。首先使用kill命令杀死8003进程，然后查看主从状态：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7fda080e69424e43b874f18f946196bd~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>可以发现，现在从机只剩下两台，为8001和8002。然后重启8003并再次查看状态：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/04368f2c95704561b6aeff9f088f0d90~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>仍然为8001和8002两台从机，证明了指令指定主从在重启后会失效。</p><p>7、进行读写测试，首先测试主机，读写均能正常：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9a659544e559403a8b2bb7a863e9d53d~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>测试从机，发现可以正常读数据，但是写数据失败：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9dde129fa3ea4ac3baa8ffb2e35145c2~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>这是因为在主从复制的架构下，只有主机能够写数据，从机为只读模式。这是在配置文件中指定的。在Redis2.6版本以后，默认从机为只读模式：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>replica-read-only <span class="token function">yes</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>需要注意这里不能将这个配置改为no，因为主机不会监听到从机的写数据事件，因而造成主从数据的不一致。</p><h4 id="二、全量复制" tabindex="-1"><a class="header-anchor" href="#二、全量复制" aria-hidden="true">#</a> 二、全量复制</h4><p>用于初次复制或其它无法进行部分复制的情况，将主节点中的所有数据都发送给从节点。当数据量过大的时候，会造成很大的网络开销。流程如下：</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/870d1ad04bbd4ede93d860a7511cbd31~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>1、从机发送：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>psync ? <span class="token parameter variable">-1</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>这里的&quot;？&quot;是因为从机暂时不知道主机的runId， -1代表全量复制</p><p>2、主机发送指令，把自己的runid和offset传给从机：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>fullresync<span class="token punctuation">{</span>runid，offset<span class="token punctuation">}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>可以通过命令查看这两个参数：</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code><span class="token comment">#可以查看runid</span>
info server 
<span class="token comment">#可以查看offset</span>
info replication
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>从机之后会上报自己的偏移量offset给主机，当主机的offset和从机的offset不一样时，说明数据不一致。</p><p>3、从机保存主机数据：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>save master info
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>4、主机执行bgsave，全量复制会触发rdb持久化。</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>bgsave
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>主机在生成rdb文件时，可能会有新的数据写入。这时redis把新写入的数据写入一个缓冲区repl_back_buffer，默认大小1M。可以通过repl-backlog-size设置缓冲区大小</p><p>5、主机发送rdb给从机：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>send rdb
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>6、主机发送缓冲区数据给从机：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>send buffer
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>7、从机把从机本身上的数据清空：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>flush old data
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>8、从机加载主机发送过来的rdb和buffer数据：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>load rdb&amp;buffer
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>在全量复制中，消耗的时间包括：</p><ul><li>执行bgsave进行持久化的时间</li><li>rdb文件网络传输时间</li><li>从节点请求请求数据时间</li><li>从机加载rdb的时间</li><li>如果从节点开启了aof持久化，可能进行aof重写的时间</li></ul><h4 id="三、部分复制" tabindex="-1"><a class="header-anchor" href="#三、部分复制" aria-hidden="true">#</a> 三、部分复制</h4><p>部分复制主要是Redis针对全量复制过高的开销进行的一种优化措施。Redis 希望能够在主机出现抖动或连接断开的时候，可以通过部分复制机制将损失降低到最低。</p><figure><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66ca7eb37ad94e5198694dbca7be25f4~tplv-k3u1fbpfcp-zoom-1.image" alt="图片" tabindex="0" loading="lazy"><figcaption>图片</figcaption></figure><p>具体流程如下：</p><ol><li>出现网络抖动，连接断开 connection lost</li><li>主机继续写复制缓冲区repl_back_buffer</li><li>从机继续尝试连接主机</li><li>从机slave 会把自己当前 runid 和偏移量传输给主机 master，并且执行 pysnc 命令同步</li><li>如果 master 发现偏移量是在缓冲区的范围内，就会返回 continue 命令</li><li>同步了 offset 的部分数据，所以部分复制的基础就是偏移量 offset。</li></ol><p>那么在正常的情况下，Redis是如何决定全量复制还是部分复制的呢？从机将自己的offset发送给主机后，主机根据offset和缓冲区大小决定能否执行部分复制：</p><ul><li>如果offset偏移量之后的数据，仍然都在复制积压缓冲区里，则执行部分复制</li><li>如果offset偏移量之后的数据已不在复制积压缓冲区中，则执行全量复制</li></ul><p>四、主从复制架构缺点</p><p>1.由于所有的写操作都是先在主机上操作，然后同步更新到从机上，所以同步过程有一定的延迟，当系统很繁忙的时候，延迟问题会更加严重。从机数量增加时，会使这个问题更加严重。</p><p>2.当主机宕机之后，将不能进行写操作，需要手动将从机升级为主机，从机需要重新指定主机。</p><p>手动在一台从机上执行下面命令，将它升级为主机：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>slave of no one
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>再在其他从机上执行slave of指令，将自身变成新主机的从机：</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>slave of 192.168.0.1 800X
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div><p>可以看出这种情况下，当主机宕机后，后续的修复流程由人工操作，非常麻烦，因此在这种情况下Redis引入了哨兵模式，来完成主机宕机后的自动故障转移，之后文章我们具体来聊聊哨兵模式。</p>`,83);function r(p,t){return a(),s("div",null,[i(" more "),l])}const o=e(d,[["render",r],["__file","mastersSlave.html.vue"]]);export{o as default};
