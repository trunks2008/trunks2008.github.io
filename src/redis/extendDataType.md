---
title: Redis 扩展数据类型详解
icon: page
order: 10
author: Hydra
date: 2021-02-28
tag:
  - Redis
  - 数据结构
star: true
---



<!-- more -->

在Redis中有5种基本数据类型，分别是String, List,  Hash, Set, Zset。除此之外，Redis中还有一些实用性很高的扩展数据类型，下面来介绍一下这些扩展数据类型以及它们的使用场景。

### Geo

GEO在Redis 3.2版本后被添加，可以说是针对`LBS（Location-Based Service）`产生的一种数据类型，主要用于存储地理位置信息，并可以对存储的信息进行一系列的计算操作。

`geoadd`：存储指定的地理空间位置：

```shell
# 语法格式：
GEOADD key longitude latitude member [longitude latitude member ...]
# 测试：
> GEOADD locations 116.419217 39.921133 beijing
> GEOADD locations 120.369557 36.094406 qingdao
```

来看一下geo数据在Redis中的存储方式，可以看到是以zset格式进行存储的，因此geo是zset的一个扩展：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b99f9dd64a6841838edad1e9d909ba9a~tplv-k3u1fbpfcp-zoom-1.image)

`geopos`：返回指定地理位置的经纬度坐标：

```shell
# 语法格式：
GEOPOS key member [member ...]
# 测试：
> GEOPOS locations beijing qingdao 
116.41921967267990112
39.92113206197632991
120.36955565214157104
36.09440522913565275
```

也可以使用`zrange`返回所有的位置元素而不带经纬度信息：

```shell
> ZRANGE locations 0 -1
qingdao
beijing
```

`geodist`：计算指定位置间的距离，并可以指定返回的距离单位：

```shell
# 语法格式：
GEODIST key member1 member2 [m|km|ft|mi]
# 测试：
> GEODIST locations beijing qingdao km
548.5196
```

`georadiusbymember`：找出以给定位置为中心，返回key包含的元素中，与中心的距离不超过给定最大距离的所有位置元素：

```shell
# 语法格式：
GEORADIUSBYMEMBER key member radius [m|km|ft|mi]
# 测试：
> GEORADIUSBYMEMBER locations beijing 150 km
beijing
# 扩大范围
> GEORADIUSBYMEMBER locations beijing 600 km
qingdao
beijing
```

`georadius`与``georadiusbymember``类似，不过是以指定的经纬度为中心：

```shell
# 语法格式：
GEORADIUS key longitude latitude radius [m|km|ft|mi]
# 测试：
> GEORADIUS  locations  116.4192 39.9211 10 km
beijing
```

geo并没有提供删除指令，但根据其底层是zset实现，我们可以使用`zrem`对数据进行删除：

```shell
> ZREM locations beijing
```

基于geo，可以很简单的存储人或物关联的经纬度信息，并对这些地理信息进行处理，例如基于查询相邻的经纬度范围，能简单实现类似“附近的人”等功能。

### Bitmap

Bitmap 也被称为位图，是以 String 类型作为底层数据结构实现的一种统计二值状态的数据类型。其中每一个bit都只能是0或1，所以通常用来表示一个对应于数组下标的数据是否存在。Bitmap 提供了一系列api，主要用于对 bit 位进行读写、计算、统计等操作。

`setbit`：对key所存储的字符串值，设置或清除指定偏移量上的位（bit）:

```shell
# 语法格式：
SETBIT key offset value
# 测试：
> SETBIT key 100 1
> SETBIT key 128 1
```

`getbit`：对key所存储的字符串值，获取指定偏移量上的位（bit）:

```shell
# 语法格式：
GETBIT key offset
# 测试：
> GETBIT key 100
1
```

`bitcount`：可以统计bit 数组中指定范围内所有 `1` 的个数，如果不指定范围，则获取所有:

```shell
# 语法格式：
BITCOUNT key [start end]
# 测试：
> BITCOUNT key
2
```

`bitpos`：计算 bit 数组中指定范围第一个偏移量对应的的值等于`targetBit`的位置：

```shell
# 语法格式：
BITPOS key tartgetBit [start end]
# 测试：
> BITPOS key 1
100
```

`bitop`：做多个bit 数组的and（交集）、or（并集）、not（非）、xor（异或）。例如对key和key2做交集操作，并将结果保存在key:and:key2中：

```shell
# 语法格式：
BITOP op destKey key1 [key2...]
# 测试：
> BITOP and key:and:key2 key key2
17
```

Bitmap底层使用String实现，value的值最大能存储512M字节，可以表示 512 * 1024 * 1024*8=4294967296个位，已经能够满足我们绝大部分的使用场景。再看一下底层存储数据的格式，以刚刚存储的key为例：

```
\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\x00\x00\x00\x80
```

将16进制的数据转化为2进制数据，如下图所示，第100位和第128位为1，其他为0：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99be165f34c44486bf902b4fa5d087c7~tplv-k3u1fbpfcp-zoom-1.image)

此外，由于Redis在存储string类型的时候存储形式为二进制，所以也可以通过操作bit位来对string类型进行操作，在下面的例子中，通过直接操作bit，将string类型的abc变成了bbc。

```shell
> set key2 abc
> setbit key2 6 1
> setbit key2 7 0
> get key2
bbc
```

另外，可以通过`bitfield`命令实现类似的效果：

```shell
> set key3 a
> BITFIELD key3 get u8 0
97
> BITFIELD key3 set u8 0 98
97
> get key3
b
```

使用`bitfield` 命令可以返回指定位域的bit值，并将它转化为整形，有符号整型需在位数前加 `i`，无符号在位数前加`u`。上面我们将8位转化为无符号整形，正好是a的`ASCII`码，再对`ASCII`码进行修改，可以直接改变字符串的值。

Bitmap的应用非常广泛，例如在缓存三大问题中我们介绍过使用Bitmap作为布隆过滤器应对缓存穿透的问题，此外布隆过滤器也被广泛用于邮件系统中拦截垃圾邮件的地址。另外，常用的用户签到、朋友圈点赞等功能也可以用它来实现。

以实现用户签到功能为例，可以将每个用户按月存储为一条数据，key的格式可以定义为 `sign:userId:yyyyMM` ，如果签到了就将对应的位置改为1，未签到为0，这样最多只需要31个bit位就可以存储一个月的数据，转换为字节的话也只要4个字节就已经足够。

```shell
# 1月10日签到，因为offset从0起始，所以将天数减1
> SETBIT sign:6666:202101 9 1
0
# 查看1月10日是否签到
> GETBIT sign:6666:202101 9
1
# 统计签到天数
> BITCOUNT  sign:6666:202101
1
# 查看首次签到的日期
> BITPOS  sign:6666:202101 1
9
# 提取整月的签到数据
> BITFIELD  sign:6666:202101 get u31 0
2097152
```

注意在使用`bitfield`指令时，有符号整型最大支持64位，而无符号整型最大支持63位。如果位数超过限制，会报如下错误：

```shell
> bitfield key3 get u64 0
ERR Invalid bitfield type. Use something like i16 u8. Note that u64 is not supported but i64 is.
```

所以在存储签到数据时，如果按月存储的话在之后提取数据时会比较方便，如果按年存储数据，在提取整年的签到数据时可能需要进行分段。

### HyperLogLog

Redis 在 2.8.9 版本添加了 HyperLogLog 结构，它是一种用于基数统计的数据集合类型。它的最大优势就在于，当集合元素数量非常多时，它计算基数所需的空间总是固定的，而且还很小。

`pfadd`：向HyperLogLog中添加数据：

```shell
# 语法格式：
PFADD key element [element ...]
# 测试：
> PFADD index.html  uuid1 uuid2 uuid3 uuid4
```

`pfcount`：返回HyperLogLog的基数统计结果：

```shell
# 语法格式：
PFCOUNT key [key ...]
# 测试：
> PFCOUNT index.html
4
```

`pfmerge`：将多个 HyperLogLog 合并为一个 HyperLogLog ，合并后的 HyperLogLog 的基数估算值是通过对所有 给定 HyperLogLog 进行并集计算得出的。

```shell
# 语法格式：
PFMERGE destkey sourcekey [sourcekey ...]
# 测试：
> PFMERGE index.html home.html
OK
> PFCOUNT index.html
6
```

例如在上面的例子中，使用HyperLogLog 可以很方便的统计网页的UV。在官方文档中指明，Redis 中每个 HyperLogLog 只需要花费 12 KB 内存，就可以对 2^64 个数据完成基数统计。尽管使用Set或Hash等结构也能实现基数统计，但这些数据结构都会消耗大量的内存。而使用HyperLogLog 时，和其他数据结构计算基数时，元素越多耗费内存就越多形成了鲜明对比。

需要注意的是，HyperLogLog是一种算法，并非是Redis独有的，并且HyperLogLog 的统计规则是基于概率完成的，所以它给出的统计结果是有一定误差的，官方给出的标准误算率是 0.81%。 HyperLogLog 只会根据输入元素来计算基数，而不会存储输入的元素本身，所以 HyperLogLog 不能像集合那样，返回输入的各个元素。

针对以上这些特性，可以总结出，HyperLogLog适用于大数据量的基数统计，但是它也存在局限性，它只能够实现统计基数的数量，但无法知道具体的原数据是什么。如果需要原数据的话，我们可以将 Bitmap 和 HyperLogLog 配合使用，例如在统计网站UV时，使用Bitmap 标识哪些用户属于活跃用户，使用 HyperLogLog 实现基数统计。

### Stream

Stream是Redis 5.0版本之后新增加的数据结构，实现了消息队列的功能，并且实现消息的持久化和主备复制功能，可以让任何客户端访问任何时刻的数据，并且能记住每一个客户端的访问位置，保证消息不丢失，下面我们看一下具体的指令。

`xadd`：向队列添加消息

```shell
# 语法格式：
XADD key ID field value [field value ...]
# 测试：
> XADD stream1 *  phone 88888888  name Hydra
"1614316213565-0"
> XADD stream1 *  key1 value1 key2 value2 key3 value3
"1614317444558-0"
```

添加消息是生成的 `1614316213565-0`，是生成消息的id，由时间戳加序号组成，时间戳是Redis的服务器时间，如果在同一个时间戳内，序号会递增来标识不同的消息。并且为了保证消息的有序性，生成的消息id是保持自增的。可以使用可视化工具查看数据，消息是以json格式被存储：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/31b4bb1d95a049629d93e20142b931e9~tplv-k3u1fbpfcp-zoom-1.image)

这里因为是不同时间戳，所以序号都是从0开始。我们可以通过redis的事务添加消息进行测试：

```shell
> MULTI
"OK"
> XADD stream * msg 1
"QUEUED"
> XADD stream * msg 2
"QUEUED"
> XADD stream * msg 3
"QUEUED"
> XADD stream * msg 4
"QUEUED"
> XADD stream * msg 5
"QUEUED"
> EXEC
 1)  "OK"
 2)  "1614319042782-0"
 3)  "OK"
 4)  "1614319042782-1"
 5)  "OK"
 6)  "1614319042782-2"
 7)  "OK"
 8)  "1614319042782-3"
 9)  "OK"
 10)  "1614319042782-4"
 11)  "OK"
```

通过上面的例子，可以看见同一时间戳内，序号会不断递增。

`xrange`：获取消息列表，会自动过滤删除的消息

```shell
# 语法格式：
XRANGE key start end [COUNT count]
# 测试：
> XRANGE stream1 - +  count 5
 1)    1)   "1614316213565-0"
  2)      1)    "phone"
   2)    "88888888"
   3)    "name"
   4)    "Hydra"
 2)    1)   "1614317444558-0"
  2)      1)    "key1"
   2)    "value1"
   3)    "key2"
   4)    "value2"
   5)    "key3"
   6)    "value3"
```

`xread`：以阻塞或非阻塞方式获取消息列表

```shell
# 语法格式：
XREAD [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] id [id ...]
# 测试：
> XREAD count 1 STREAMS stream1 0-1
 1)    1)   "stream1"
  2)      1)        1)     "1614316213565-0"
    2)          1)      "phone"
     2)      "88888888"
     3)      "name"
     4)      "Hydra"
```

`xdel`：删除消息

```shell
# 语法格式：
XDEL key ID [ID ...]
# 测试：
> XDEL stream1 1614317444558-0
"1"
```

除了上面消息队列的基本操作外，还可以创建消费者组对消息进行消费。首先使用`xgroup create` 创建消费者组：

```shell
# 语法格式：
XGROUP [CREATE key groupname id-or-$] [SETID key groupname id-or-$] [DESTROY key groupname] [DELCONSUMER key groupname consumername]
# 创建一个队列，从头开始消费：
> XGROUP CREATE stream1 consumer-group-1 0-0  
# 创建一个队列，从尾部开始消费，只接收新消息：
> XGROUP CREATE stream1 consumer-group-2 $  
```

下面使用消费者组消费消息：

```shell
# 语法格式
XREADGROUP GROUP group consumer [COUNT count] [BLOCK milliseconds] [NOACK] STREAMS key [key ...] ID [ID ...]
```

注意这里消费消息的对象是 `consumer`消费者，而不是消费者组。在消费消息时，不需要预先创建消费者，在消费过程中直接指定就可以。接下来再向stream中发送一条消息，比较两个消费者组的消费顺序差异：

```shell
# 重新发送一条消息
> XADD stream1 * newmsg hi
"1614318022661-0"
# 使用消费者组1消费：
> XREADGROUP GROUP consumer-group-1 consumer1 COUNT 1 STREAMS stream1 >
 1)    1)   "stream1"
  2)      1)        1)     "1614316213565-0"
    2)          1)      "phone"
     2)      "88888888"
     3)      "name"
     4)      "Hydra"
# 使用消费者组2消费：
> XREADGROUP GROUP consumer-group-2 consumer2 COUNT 1 STREAMS stream1 >
 1)    1)   "stream1"
  2)      1)        1)     "1614318022661-0"
    2)          1)      "newmsg"
     2)      "hi"
```

可以看到，消费者组1从stream的头部开始消费，而消费者组2从创建消费者组后的最新消息开始消费。在消费者组2内使用新的消费者再次进行消费：

```shell
> XREADGROUP GROUP consumer-group-2 consumer4 COUNT 1 STREAMS stream1 >

> XADD stream1 * newmsg2 hi2
"1614318706162-0"
> XREADGROUP GROUP consumer-group-2 consumer4 COUNT 1 STREAMS stream1 >
 1)    1)   "stream1"
  2)      1)        1)     "1614318706162-0"
    2)          1)      "newmsg2"
     2)      "hi2"
```

在上面的例子中，可以看到在一个消费者组中，存在互斥原则，即一条消息被一个消费者消费过后，其他消费者就不能再消费这条消息了。

`xpending`：等待列表用于记录读取但并未处理完毕的消息，可以使用它来获取未处理完毕的消息。

```shell
> XPENDING stream1 consumer-group-2
 1)  "2"  # 2条已读取但未处理的消息
 2)  "1614318022661-0"  # 起始消息ID
 3)  "1614318706162-0"  # 结束消息ID
 4)    1)      1)    "consumer2"   # 消费者2有1个
   2)    "1"
  2)      1)    "consumer4"       # 消费者4有1个
   2)    "1"
```

在 `xpending` 命令后添加` start end count `参数可以获取详细信息：

```shell
> XPENDING stream1 consumer-group-2 - + 10
 1)    1)   "1614318022661-0"  # 消息ID
  2)   "consumer2"   # 消费者
  3)   "1867692"    # 从读取到现在经历的毫秒数
  4)   "1"		#消息被读取次数
 2)    1)   "1614318706162-0"
  2)   "consumer4"
  3)   "1380323"
  4)   "1"
```

`xack`：告知消息被处理完成，移出pending列表

```shell
> XACK stream1 consumer-group-2  1614318022661-0 
"1"
```

再次查看pending列表，可以看到`1614318022661-0` 已被移除：

```shell
> XPENDING stream1 consumer-group-2 
 1)  "1"
 2)  "1614318706162-0"
 3)  "1614318706162-0"
 4)    1)      1)    "consumer4"
   2)    "1"
```

基于以上功能，如果我们的系统中已经使用了redis，甚至可以移除掉不需要的其他消息队列中间件，来达到精简应用系统的目的。并且，Redis Stream提供了消息的持久化和主从复制，能够很好的保证消息的可靠性。
