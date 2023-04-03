---
title: 面试官：Redis的事务满足原子性吗？
icon: page
order: 4
author: Hydra
date: 2021-09-08
tag:
  - Redis
  - Lua
  - 事务
star: true
---



<!-- more -->

谈起数据库的事务来，估计很多同学的第一反应都是`ACID`，而排在`ACID`中首位的`A`原子性，要求一个事务中的所有操作，要么全部完成，要么全部不完成。熟悉redis的同学肯定知道，在redis中也存在事务，那么它的事务也满足原子性吗？下面我们就来一探究竟。

### 什么是Redis事务？

和数据库事务类似，redis事务也是用来一次性地执行多条命令。使用起来也很简单，可以用`MULTI`开启一个事务，然后将多个命令入队到事务的队列中，最后由`EXEC`命令触发事务，执行事务中的所有命令。看一个简单的事务执行例子：

```shell
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set name Hydra
QUEUED
127.0.0.1:6379> set age 18
QUEUED
127.0.0.1:6379> incr age
QUEUED
127.0.0.1:6379> exec
1) OK
2) OK
3) (integer) 19
```

可以看到，在指令和操作数的数据类型等都正常的情况下，输入`EXEC`后所有命令被执行成功。

### Redis事务满足原子性吗？

如果要验证redis事务是否满足原子性，那么需要在redis事务执行发生异常的情况下进行，下面我们分两种不同类型的错误分别测试。

#### 语法错误

首先测试命令中有语法错误的情况，这种情况多为命令的参数个数不正确或输入的命令本身存在错误。下面我们在事务中输入一个存在格式错误的命令，开启事务并依次输入下面的命令：

```shell
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set name Hydra
QUEUED
127.0.0.1:6379> incr
(error) ERR wrong number of arguments for 'incr' command
127.0.0.1:6379> set age 18
QUEUED
```

输入的命令`incr`后面没有添加参数，属于命令格式不对的语法错误，这时在命令入队时就会立刻检测出错误并提示`error`。使用`exec`执行事务，查看结果输出：

```shell
127.0.0.1:6379> exec
(error) EXECABORT Transaction discarded because of previous errors.
```

在这种情况下，只要事务中的一条命令有语法错误，在执行`exec`后就会直接返回错误，包括语法正确的命令在内的所有命令都不会被执行。对此进行验证，看一下在事务中其他指令执行情况，查看`set`命令的执行结果，全部为空，说明指令没有被执行。

```shell
127.0.0.1:6379> get name
(nil)
127.0.0.1:6379> get age
(nil)
```

此外，如果存在命令本身拼写错误、或输入了一个不存在的命令等情况，也属于语法错误的情况，执行事务时会直接报错。

#### 运行错误

运行错误是指输入的指令格式正确，但是在命令执行期间出现的错误，典型场景是当输入参数的数据类型不符合命令的参数要求时，就会发生运行错误。例如下面的例子中，对一个`string`类型的值执行列表的操作，报错如下：

```shell
127.0.0.1:6379> set key1 value1
OK
127.0.0.1:6379> lpush key1 value2
(error) WRONGTYPE Operation against a key holding the wrong kind of value
```

这种错误在redis实际执行指令前是无法被发现的，只能当真正执行才能够被发现，因此这样的命令是可以被事务队列接收的，不会和上面的语法错误一样立即报错。

具体看一下当事务中存在运行错误的情况，在下面的事务中，尝试对`string`类型数据进行`incr`自增操作：

```shell
127.0.0.1:6379> multi
OK
127.0.0.1:6379> set name Hydra
QUEUED
127.0.0.1:6379> set age eighteen
QUEUED
127.0.0.1:6379> incr age
QUEUED
127.0.0.1:6379> del name
QUEUED
```

redis一直到这里都没有提示存在错误，执行`exec`看一下结果输出：

```shell
127.0.0.1:6379> exec
1) OK
2) OK
3) (error) ERR value is not an integer or out of range
4) (integer) 1
```

运行结果可以看到，虽然`incr age`这条命令出现了错误，但是它前后的命令都正常执行了，再看一下这些`key`对应的值，确实证明了其余指令都执行成功：

```shell
127.0.0.1:6379> get name
(nil)
127.0.0.1:6379> get age
"eighteen"
```

#### 阶段性结论

对上面的事务的运行结果进行一下分析：

- 存在**语法错误**的情况下，所有命令都不会执行
- 存在**运行错误**的情况下，除执行中出现错误的命令外，其他命令都能正常执行

通过分析我们知道了redis中的事务是不满足原子性的，在运行错误的情况下，并没有提供类似数据库中的回滚功能。那么为什么redis不支持回滚呢，官方文档给出了说明，大意如下：

- redis命令失败只会发生在语法错误或数据类型错误的情况，这一结果都是由编程过程中的错误导致，这种情况应该在开发环境中检测出来，而不是生产环境
- 不使用回滚，能使redis内部设计更简单，速度更快
- 回滚不能避免编程逻辑中的错误，如果想要将一个键的值增加2却只增加了1，这种情况即使提供回滚也无法提供帮助

基于以上原因，redis官方选择了更简单、更快的方法，不支持错误回滚。这样的话，如果在我们的业务场景中需要保证原子性，那么就要求了开发者通过其他手段保证命令全部执行成功或失败，例如在执行命令前进行参数类型的校验，或在事务执行出现错误时及时做事务补偿。

提到其他方式，相信很多小伙伴都听说**使用Lua脚本来保证操作的原子性**，例如在分布式锁中通常使用的就是`Lua`脚本，那么，神奇的`Lua`脚本真的能保证原子性吗？

### 简单的Lua脚本入门

在验证lua脚本的原子性之前，我们需要对它做一个简单的了解。redis从2.6版本开始支持执行lua脚本，它的功能和事务非常类似，一段lua脚本被视作一条命令执行，这样将多条redis命令写入lua，即可实现类似事务的执行结果。我们先看一下下面几个常用的命令。

#### EVAL 命令

最常用的`EVAL`用于执行一段脚本，它的命令的格式如下：

```shell
EVAL script numkeys key [key ...] arg [arg ...] 
```

简单解释一下其中的参数：

- `script`是一段lua脚本程序
- `numkeys`指定后续参数有几个`key`，如没有`key`则为0
- `key [key …]`表示脚本中用到的redis中的键，在lua脚本中通过`KEYS[i]`的形式获取
- `arg [arg …]`表示附加参数，在lua脚本中通过`ARGV[i]`获取

看一个简单的例子：

```shell
127.0.0.1:6379> eval "return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}" 2 key1 key2 value1 vauel2
1) "key1"
2) "key2"
3) "value1"
4) "vauel2"
```

在上面的命令中，双引号中是lua脚本程序，后面的2表示存在两个key，分别是`key1`和`key2`，之后的参数是附加参数`value1`和`value2`。

如果想要使用lua脚本执行`set`命令，可以写成这样：

```shell
127.0.0.1:6379> EVAL "redis.call('SET', KEYS[1], ARGV[1]);" 1 name Hydra
(nil)
```

这里使用了redis内置的lua函数`redis.call`来完成`set`命令，这里打印的执行结果`nil`是因为没有返回值，如果不习惯的话，其实我们可以在脚本中添加`return 0;`的返回语句。

#### SCRIPT LOAD 和 EVALSHA命令

这两个命令放在一起是因为它们一般成对使用。先看`SCRIPT LOAD`，它用于把脚本加载到缓存中，返回`SHA1`校验和，这时候只是缓存了命令，但是命令没有被马上执行，看一个例子：

```shell
127.0.0.1:6379> SCRIPT LOAD "return redis.call('GET', KEYS[1]);"
"228d85f44a89b14a5cdb768a29c4c4d907133f56"
```

这里返回了一个`SHA1`的校验和，接下来就可以使用`EVALSHA`来执行脚本了：

```shell
127.0.0.1:6379> EVALSHA "228d85f44a89b14a5cdb768a29c4c4d907133f56" 1 name
"Hydra"
```

这里使用这个`SHA1`值就相当于导入了上面缓存的命令，在之后再拼接`numkeys`、`key`、`arg`等参数，命令就能够正常执行了。

#### 其他命令

使用`SCRIPT EXISTS`命令判断脚本是否被缓存：

```shell
127.0.0.1:6379> SCRIPT EXISTS 228d85f44a89b14a5cdb768a29c4c4d907133f56
1) (integer) 1
```

使用`SCRIPT FLUSH`命令清除redis中的lua脚本缓存：

```shell
127.0.0.1:6379> SCRIPT FLUSH
OK
127.0.0.1:6379> SCRIPT EXISTS 228d85f44a89b14a5cdb768a29c4c4d907133f56
1) (integer) 0
```

可以看到，执行了`SCRIPT FLUSH`后，再次通过`SHA1`值查看脚本时已经不存在。最后，还可以使用`SCRIPT KILL`命令杀死当前正在运行的 lua 脚本，但是只有当脚本没有执行写操作时才会生效。

从这些操作看来，lua脚本具有下面的优点：

- 多次网络请求可以在一次请求中完成，减少网络开销，减少了网络延迟
- 客户端发送的脚本会存在redis中，其他客户端可以复用这一脚本，而不需要再重复编码完成相同的逻辑

#### Java代码中使用lua脚本

在Java代码中可以使用Jedis中封装好的API来执行lua脚本，下面是一个使用Jedis执行lua脚本的例子：

```java
public static void main(String[] args) {
    Jedis jedis = new Jedis("127.0.0.1", 6379);
    String script="redis.call('SET', KEYS[1], ARGV[1]);"
            +"return redis.call('GET', KEYS[1]);";
    List<String> keys= Arrays.asList("age");
    List<String> values= Arrays.asList("eighteen");
    Object result = jedis.eval(script, keys, values);
    System.out.println(result);
}
```

执行上面的代码，控制台打印了`get`命令返回的结果：

```
eighteen
```

简单的铺垫完成后，我们来看一下lua脚本究竟能否实现回滚级别的原子性。对上面的代码进行改造，插入一条运行错误的命令：

```java
public static void main(String[] args) {
    Jedis jedis = new Jedis("127.0.0.1", 6379);
    String script="redis.call('SET', KEYS[1], ARGV[1]);"
            +"redis.call('INCR', KEYS[1]);"
            +"return redis.call('GET', KEYS[1]);";
    List<String> keys= Arrays.asList("age");
    List<String> values= Arrays.asList("eighteen");
    Object result = jedis.eval(script, keys, values);
    System.out.println(result);
}
```

查看执行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df545db3c0914554b771f3217768a47f~tplv-k3u1fbpfcp-zoom-1.image)

再到客户端执行一下get命令：

```shell
127.0.0.1:6379> get age
"eighteen"
```

也就是说，虽然程序抛出了异常，但异常前的命令还是被正常的执行了且没有被回滚。再试试直接在redis客户端中运行这条指令：

```shell
127.0.0.1:6379> flushall
OK
127.0.0.1:6379> eval "redis.call('SET', KEYS[1], ARGV[1]);redis.call('INCR', KEYS[1]);return redis.call('GET', KEYS[1])" 1 age eight
(error) ERR Error running script (call to f_c2ea9d5c8f60735ecbedb47efd42c834554b9b3b): @user_script:1: ERR value is not an integer or out of range
127.0.0.1:6379> get age
"eight"
```

同样，错误之前的指令仍然没有被回滚，那么我们之前经常听说的`Lua`脚本保证原子性操作究竟是怎么回事呢？

其实，在redis中是使用的同一个lua解释器来执行所有命令，也就保证了当一段lua脚本在执行时，不会有其他脚本或redis命令同时执行，保证了操作不会被其他指令插入或打扰，实现的仅仅是这种程度上的原子性。

但是遗憾的是，如果脚本运行时出错并中途结束，之后的操作不会进行，但是之前已经发生的写操作不会撤销，所以即使使用了lua脚本，也不能实现类似数据库回滚的原子性。

> 本文基于redis 5.0.3 进行测试
>
> 官方文档相关说明：https://redis.io/topics/transactions