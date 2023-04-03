---
title: Redis实现分布式锁
icon: page
order: 7
author: Hydra
date: 2020-08-09
tag:
  - 分布式锁
  - Redis
star: true
---



<!-- more -->

在之前并发系列的文章中，我们介绍了JVM中的锁。但是无论是`synchronized`还是`Lock`，都运行在线程级别上，必须运行在同一个JVM中。如果竞争资源的进程不在同一个JVM中时，这样线程锁就无法起到作用，必须使用分布式锁来控制多个进程对资源的访问。

分布式锁的实现一般有三种方式，使用MySql数据库行锁，基于Redis的分布式锁，以及基于Zookeeper的分布式锁。本文中我们重点看一下Redis如何实现分布式锁。

首先，看一下用于实现分布式锁的两个Redis基础命令：

```
setnx key value
```

这里的`setnx`，是"set if Not eXists"的缩写，表示当指定的key值不存在时，为key设定值为value。如果key存在，则设定失败。

```
setex key timeout value
```

`setex`命令为指定的key设置值及其过期时间（以秒为单位）。如果key已经存在，setex命令将会替换旧的值。

基于这两个指令，我们能够实现：

- 使用`setnx` 命令，保证同一时刻只有一个线程能够获取到锁
- 使用`setex` 命令，保证锁会超期释放，从而不因一个线程长期占有一个锁而导致死锁。

这里将两个命令结合在一起使用的原因是，在正常情况下，如果只使用`setnx` 命令，使用完成后使用`delete`命令删除锁进行释放，不存在什么问题。但是如果获取分布式锁的线程在运行中挂掉了，那么锁将不被释放。如果使用setex 设置了过期时间，即使线程挂掉，也可以自动进行锁的释放。

## 手写Redis分布式锁

接下来，我们基于Redis+Spring手写实现一个分布式锁。首先配置Jedis连接池：

```java
@Configuration
public class Config {
    @Bean
    public JedisPool jedisPool(){
        JedisPoolConfig jedisPoolConfig=new JedisPoolConfig();
        jedisPoolConfig.setMaxIdle(100);
        jedisPoolConfig.setMinIdle(1);
        jedisPoolConfig.setMaxWaitMillis(2000);
        jedisPoolConfig.setTestOnBorrow(true);
        jedisPoolConfig.setTestOnReturn(true);
        JedisPool jedisPool=new JedisPool(jedisPoolConfig,"127.0.0.1",6379);
        return  jedisPool;
    }
}
```

实现RedisLock分布式锁：

```java
public class RedisLock implements Lock {
    @Autowired
    JedisPool jedisPool;

    private static final String key = "lock";
    private ThreadLocal<String> threadLocal = new ThreadLocal<>();

    @Override
    public void lock() {
        boolean b = tryLock();
        if (b) {
            return;
        }
        try {
            TimeUnit.MILLISECONDS.sleep(50);
        } catch (Exception e) {
            e.printStackTrace();
        }
        lock();//递归调用
    }

    @Override
    public boolean tryLock() {
        SetParams setParams = new SetParams();
        setParams.ex(10);
        setParams.nx();
        String s = UUID.randomUUID().toString();
        Jedis resource = jedisPool.getResource();
        String lock = resource.set(key, s, setParams);
        resource.close();
        if ("OK".equals(lock)) {
            threadLocal.set(s);
            return true;
        }
        return false;
    }

    //解锁判断锁是不是自己加的
    @Override
    public void unlock(){
        //调用lua脚本解锁
        String script="if redis.call(\"get\",KEYS[1]==ARGV[1] then\n"+
                "   return redis.call(\"del\",KEYS[1])\n"+
                "else\n"+
                "   return 0\n"+
                "end";
        Jedis resource = jedisPool.getResource();
        Object eval=resource.eval(script, Arrays.asList(key),Arrays.asList(threadLocal.get()));
        if (Integer.valueOf(eval.toString())==0){
            resource.close();
            throw new RuntimeException("解锁失败");
        }
        /*
        *不写成下面这种也是因为不是原子操作,和ex、nx相同
        String s = resource.get(key);
        if (threadLocal.get().equals(s)){
            resource.del(key);
        }
        */
        resource.close();
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return false;
    }

    @Override
    public Condition newCondition() {
        return null;
    }
}
```

简单对上面代码中需要注意的地方做一解释：

- 加锁过程中，使用`SetParams` 同时设置`nx`和`ex`的值，保证原子操作
- 通过`ThreadLocal`保存key对应的value，通过value来判断锁是否当前线程自己加的，避免线程错乱解锁
- 释放锁的过程中，使用`lua`脚本进行删除，保证Redis在执行此脚本时不执行其他操作，从而保证操作的原子性

但是，这段手写的代码可能会存在一个问题，就是不能保证业务逻辑一定能被执行完成，因为设置了锁的过期时间可能导致过期。

## Redisson

基于上面存在的问题，我们可以使用Redisson分布式可重入锁。Redisson内部提供了一个监控锁的看门狗，它的作用是在Redisson实例被关闭前，不断的延长锁的有效期。

引入依赖：

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson</artifactId>
    <version>3.10.7</version>
</dependency>
```

配置`RedissonClient`，然后我们对常用方法进行测试。

```java
@Configuration
public class RedissonConfig {
    @Bean
    public RedissonClient redissonClient(){
        Config config=new Config();
        config.useSingleServer().setAddress("redis://127.0.0.1:6379");
        RedissonClient redissonClient= Redisson.create(config);
        return redissonClient;
    }
}
```


### lock()

先写一个测试接口：

```java
@GetMapping("/lock")
public String test() {
    RLock lock = redissonClient.getLock("lock");
    lock.lock();
    System.out.println(Thread.currentThread().getName()+" get redisson lock");

    try {
        System.out.println("do something");
        TimeUnit.SECONDS.sleep(20);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    lock.unlock();
    System.out.println(Thread.currentThread().getName()+ " release lock");

   return "locked";
}
```

进行测试，同时发送两个请求，redisson锁生效：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dcc65320307548b6b1eb8df39ab4a882~tplv-k3u1fbpfcp-zoom-1.image)

###  lock(long leaseTime, TimeUnit unit)

Redisson可以给`lock()`方法提供`leaseTime`参数来指定加锁的时间，超过这个时间后锁可以自动释放。测试接口：

```java
@GetMapping("/lock2")
public String test2() {
    RLock lock = redissonClient.getLock("lock");
    lock.lock(10,TimeUnit.SECONDS);
    System.out.println(Thread.currentThread().getName()+" get redisson lock");

    try {
        System.out.println("do something");
        TimeUnit.SECONDS.sleep(20);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    System.out.println(Thread.currentThread().getName()+ " release lock");
    return "locked";
}
```

运行结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/422f5fe7ab0b4d0d852b788164405c62~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，在第一个线程还没有执行完成时，就释放了redisson锁，第二个线程进入后，两个线程可以同时执行被锁住的代码逻辑。这样可以实现无需调用`unlock`方法手动解锁。

### tryLock(long waitTime, long leaseTime, TimeUnit unit)

`tryLock`方法会尝试加锁，最多等待`waitTime`秒，上锁以后过`leaseTime`秒自动解锁；如果没有等待时间，锁不住直接返回false。

```java
@GetMapping("/lock3")
public String test3() {
    RLock lock = redissonClient.getLock("lock");
    try {
        boolean res = lock.tryLock(5, 30, TimeUnit.SECONDS);
        if (res){
            try{
                System.out.println(Thread.currentThread().getName()+" 获取到锁，返回true");
                System.out.println("do something");
                TimeUnit.SECONDS.sleep(20);
            }finally {
                lock.unlock();
                System.out.println(Thread.currentThread().getName()+" 释放锁");
            }
        }else {
            System.out.println(Thread.currentThread().getName()+" 未获取到锁，返回false");
        }
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    return "lock";
}
```

运行结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/247f0b8da052450684af84342abf491a~tplv-k3u1fbpfcp-zoom-1.image)

可见在第一个线程获得锁后，第二个线程超过等待时间仍未获得锁，返回false放弃获得锁的过程。

除了以上单机Redisson锁以外，还支持我们之前提到过的哨兵模式和集群模式，只需要改变Config的配置即可。以集群模式为例：

```java
@Bean
public RedissonClient redissonClient(){
    Config config=new Config();
    config.useClusterServers().addNodeAddress("redis://172.20.5.170:7000")
        .addNodeAddress("redis://172.20.5.170:7001")
        .addNodeAddress("redis://172.20.5.170:7002")
        .addNodeAddress("redis://172.20.5.170:7003")
        .addNodeAddress("redis://172.20.5.170:7004")
        .addNodeAddress("redis://172.20.5.170:7005");
    RedissonClient redissonClient = Redisson.create(config);
    return redissonClient;
}
```

## RedLock红锁

下面介绍一下Redisson红锁`RedissonRedLock`，该对象也可以用来将多个`RLock`对象关联为一个红锁，每个`RLock`对象实例可以来自于不同的Redisson实例。

`RedissonRedLock`针对的多个Redis节点，这多个节点可以是集群，也可以不是集群。当我们使用`RedissonRedLock`时，只要在大部分节点上加锁成功就算成功。看一下使用：

```java
@GetMapping("/testRedLock")
public void testRedLock() {
    Config config1 = new Config();
    config1.useSingleServer().setAddress("redis://172.20.5.170:6379");
    RedissonClient redissonClient1 = Redisson.create(config1);

    Config config2 = new Config();
    config2.useSingleServer().setAddress("redis://172.20.5.170:6380");
    RedissonClient redissonClient2 = Redisson.create(config2);

    Config config3 = new Config();
    config3.useSingleServer().setAddress("redis://172.20.5.170:6381");
    RedissonClient redissonClient3 = Redisson.create(config3);

    String resourceName = "REDLOCK";
    RLock lock1 = redissonClient1.getLock(resourceName);
    RLock lock2 = redissonClient2.getLock(resourceName);
    RLock lock3 = redissonClient3.getLock(resourceName);

    RedissonRedLock redLock = new RedissonRedLock(lock1, lock2, lock3);
    boolean isLock;
    try {
        isLock = redLock.tryLock(5, 30, TimeUnit.SECONDS);
        if (isLock) {
            System.out.println("do something");
            TimeUnit.SECONDS.sleep(20);
        }
    } catch (Exception e) {
        e.printStackTrace();
    } finally {
        redLock.unlock();
    }
}
```

相对于单Redis节点来说，`RedissonRedLock`的优点在于防止了单节点故障造成整个服务停止运行的情况；并且在多节点中锁的设计，及多节点同时崩溃等各种意外情况有自己独特的设计方法。使用`RedissonRedLock`，性能方面会比单节点Redis分布式锁差一些，但可用性比普通锁高很多。