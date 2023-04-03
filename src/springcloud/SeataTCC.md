---
title: Seata TCC模式原理与实战
icon: page
order: 7
author: Hydra
date: 2021-05-17
tag:
  - Spring Cloud Alibaba
  - Seata 
star: true
---



<!-- more -->

在前面的文章中，我们学习了Seata的搭建以及AT模式的使用，通过实践可以发现在AT模式下，用户只需要关注自己的业务，具体分布式事务的处理过程对用户来说是透明的，适用于用户不希望对业务进行改造的场景。Seata中除了AT模式外，还有TCC、Sage、XA三种模式，接下来我们继续研究一下TCC模式及其使用过程。

与AT模式下不需要业务改造不同，TCC分布式事务需要开发者进行业务逻辑的拆分，通常需要将业务系统的一整段逻辑分为三个阶段：

- Try：完成所有业务检查，预留必须的业务资源
- Confirm：真正执行的业务逻辑，不做任何业务检查，只使用Try阶段预留的业务资源。因此只要Try操作成功，Confirm一定能成功
- Cancel：释放Try阶段预留的业务资源，同样Cancel操作也需要满足幂等性

根据上面的描述，再和AT模式进行一下对比，TCC模式具有以下特点：

1. TCC与AT模式相同，都是二阶段提交，但是TCC对业务代码侵入性很强：

 - AT模式下，用户只需要关注自己的业务SQL，用户的业务SQL作为一阶段，Seata框架会自动生成事务的二阶段提交和回滚操作
 - TCC模式下，所有事务都要手动实现Try，Confirm，Cancel三个方法

2. TCC执行效率更高

- AT模式下，在本地事务提交前，要尝试先拿到该记录的全局锁
- TCC模式下，不需要对数据加全局锁，允许多个事务同时操作数据，因此TCC是高性能分布式事务的解决方案，适用于对性能有很高要求的场景

接下来，在具体的业务场景中看一下TCC模式需要怎么应用。我们对上一篇中的微服务进行改造，首先修改订单服务的业务逻辑。将创建订单的操作分为3步：

- Try阶段，生成订单，但是将订单状态设为冻结状态，这里使用1表示订单的冻结状态，0表示正常状态：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3be91ffa20b04d6285e127570700cd93~tplv-k3u1fbpfcp-zoom-1.image)

- Confirm阶段，提交事务，将订单从冻结状态修改为正常状态：
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7222deea5f3b4a40bbe223d01bd7096e~tplv-k3u1fbpfcp-zoom-1.image)

- Cancel阶段，回滚事务，删除订单：

  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c75b000b9c324a1e8e8a279d9307008e~tplv-k3u1fbpfcp-zoom-1.image)


梳理完了3段业务逻辑，下面开始写代码，使用TCC模式时，首先需要创建一个接口：

```java
@LocalTCC
public interface OrderTccAction {
    @TwoPhaseBusinessAction(name="orderAction",commitMethod = "commit",rollbackMethod = "rollback")
    boolean createOrder(BusinessActionContext businessActionContext,
                        @BusinessActionContextParameter(paramName = "order") Order order);
    boolean commit(BusinessActionContext businessActionContext);
    boolean rollback(BusinessActionContext businessActionContext);
}
```

在这个接口上，要添加`@LocalTCC`注解，并且声明三个方法：

  1. 这里的`createOrder`方法对应第一阶段的try阶段

 - 方法中，通过注解指定第二阶段的两个方法名
 - 方法中的参数`BusinessActionContext` 是一个上下文对象，用来在两个阶段之间传递数据。
 - `@BusinessActionContextParameter` 注解的参数数据会被存入 `BusinessActionContext`

2. `commit` 为第二阶段提交操作
3. `rollback` 为第二阶段回滚操作

在实现类中，实现业务逻辑：

```java
@Slf4j
@Component
public class OrderTccActionImpl implements OrderTccAction{

    @Autowired
    private OrderMapper orderMapper;

    @Override
    @Transactional
    public boolean createOrder(BusinessActionContext businessActionContext, Order order) {
        order.setStatus(1);
        orderMapper.insert(order);
        log.info("创建订单：tcc一阶段try成功");
        return true;
    }

    @Override
    @Transactional
    public boolean commit(BusinessActionContext businessActionContext) {
        JSONObject jsonObject= (JSONObject) businessActionContext.getActionContext("order");
        Order order=new Order();
        BeanUtil.copyProperties(jsonObject,order);
        order.setStatus(0);
        orderMapper.update(order,new LambdaQueryWrapper<Order>().eq(Order::getOrderNumber,order.getOrderNumber()));
        log.info("创建订单：tcc二阶段commit成功");
        return true;
    }

    @Override
    @Transactional
    public boolean rollback(BusinessActionContext businessActionContext) {
        JSONObject jsonObject= (JSONObject) businessActionContext.getActionContext("order");
        Order order=new Order();
        BeanUtil.copyProperties(jsonObject,order);
        orderMapper.delete(new LambdaQueryWrapper<Order>().eq(Order::getOrderNumber,order.getOrderNumber()));
        log.info("创建订单：tcc二阶段回滚成功");
        return true;
    }
}
```

修改Service类：

```java
@Service("orderTccService")
public class OrderTccServiceImpl implements OrderService{
    @Autowired
    OrderTccAction orderTccAction;

    @Override
    @GlobalTransactional
    public String buy(){
        Order order=new Order();
        order.setOrderNumber(IdUtil.createSnowflake(1,1).nextIdStr())
                .setMoney(100D);
        boolean result = orderTccAction.createOrder(null, order);
        // if (result){
        //   throw new RuntimeException("异常测试，准备rollBack");
        // }       
        return "success";
    }
}
```

启动微服务，进行测试，首先测试正常执行情况，两个阶段都执行成功：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/59e15ac13f0748f796dd98299bea1a00~tplv-k3u1fbpfcp-zoom-1.image)

把service中注释的代码放开，手动抛出异常，可以看到执行了rollback的回滚操作：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6f6054b535614199aca08f06dbded7c9~tplv-k3u1fbpfcp-zoom-1.image)

在测试完单个微服务后，接下来测试微服务间调用下TCC分布式事务的工作情况，下面对库存服务进行改造。同样，将减少库存的操作进行拆分，假设对库存表进行操作前数据如下：
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/40506dd6081f4402a7e42fdaba92bf67~tplv-k3u1fbpfcp-zoom-1.image)


- Try阶段，从库存数量中取出预留扣减的数量，进行冻结：
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b644903d3ff04914b988b8dd032c24d9~tplv-k3u1fbpfcp-zoom-1.image)

- Confirm阶段，提交事务，使用冻结的库存数量完成业务数据处理：
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24ad1dac7bc04f258382f795b61aac43~tplv-k3u1fbpfcp-zoom-1.image)

- Cancel阶段，回滚事务，将冻结的库存解冻，恢复至之前的库存数量：
  ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0b6d66cf1da94d62b6fea0695fcd3c38~tplv-k3u1fbpfcp-zoom-1.image)


编写代码时同样先创建接口：

```java
@LocalTCC
public interface StockTccAction {
    @TwoPhaseBusinessAction(name = "stockAction",commitMethod = "commit",rollbackMethod = "rollback")
    boolean reduceStock(BusinessActionContext businessActionContext,
                        @BusinessActionContextParameter(paramName = "proId") Long proId,
                        @BusinessActionContextParameter(paramName = "quantity") Integer quantity);
    boolean commit(BusinessActionContext businessActionContext);
    boolean rollback(BusinessActionContext businessActionContext);
}
```

实现类：

```java
@Slf4j
@Component
public class StockTccActionImpl implements StockTccAction {
    @Autowired
    private StockMapper stockMapper;

    @Override
    @Transactional
    public boolean reduceStock(BusinessActionContext businessActionContext, Long proId, Integer quantity) {
        Stock stock = stockMapper.selectOne(new LambdaQueryWrapper<Stock>().eq(Stock::getProId, proId));
        stock.setTotal(stock.getTotal()-quantity);
        stock.setFrozen(stock.getFrozen()+quantity);
        stockMapper.updateById(stock);
        log.info("减少库存：tcc一阶段try成功");
        return true;
    }

    @Override
    @Transactional
    public boolean commit(BusinessActionContext businessActionContext) {
        long proId = Long.parseLong(businessActionContext.getActionContext("proId").toString());
        int quantity = Integer.parseInt(businessActionContext.getActionContext("quantity").toString());

        Stock stock = stockMapper.selectOne(new LambdaQueryWrapper<Stock>().eq(Stock::getProId, proId));
        stock.setFrozen(stock.getFrozen()-quantity);
        stock.setSold(stock.getSold()+quantity);
        stockMapper.updateById(stock);

        log.info("减少库存：tcc二阶段commit成功");
        return true;
    }

    @Override
    @Transactional
    public boolean rollback(BusinessActionContext businessActionContext) {
        long proId = Long.parseLong(businessActionContext.getActionContext("proId").toString());
        int quantity = Integer.parseInt(businessActionContext.getActionContext("quantity").toString());

        Stock stock = stockMapper.selectOne(new LambdaQueryWrapper<Stock>().eq(Stock::getProId, proId));
        stock.setTotal(stock.getTotal()+quantity);
        stock.setFrozen(stock.getFrozen()-quantity);
        stockMapper.updateById(stock);

        log.info("减少库存：tcc二阶段回滚成功");
        return true;
    }
}
```

进行测试，使用FeigClient在OrderService中调用StockService：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a30c1a3e4b0f4700afbbced0f711381e~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，在库存服务的Tcc二阶段产生了多次commit提交的问题，也就是说在二阶段可能会产生接口多次调用的问题，因此我们需要对接口进行幂等性处理。在这里添加一个幂等性处理工具类，避免try阶段方法被多次发起，以及在commit或rollback执行成功后，再次调用方法时直接返回。这里使用了Guava中的HashBasedTable类，可以简化通过两个键确定一个值的情况，从而避免Map的嵌套操作。

```java
public class IdempotentUtil {
    private static Table<Class<?>,String,String> map=HashBasedTable.create();

    public static void addMarker(Class<?> clazz,String xid,String marker){
        map.put(clazz,xid,marker);
    }

    public static String getMarker(Class<?> clazz,String xid){
        return map.get(clazz,xid);
    }

    public static void removeMarker(Class<?> clazz,String xid){
        map.remove(clazz,xid);
    }
}
```

我们使用Table数据结构，维护了一个以类和事务的xid作为key，标记作为value的本地缓存。在存放标记后，在每次提交或回滚阶段，都要去检查这个标记是否存在。如果标记存在，说明是第一次执行提交或回滚，正常执行下面的业务逻辑，执行完成后，删除这个标记。如果检测后发现标记不存在，证明已经执行完成，那么直接返回，不执行后续的业务逻辑。

修改StockService，在try阶段添加标识，在三个不同阶段都要根据幂等性标识进行判断，并在commit或rollback执行完成后删除：

```java
@Override
@Transactional
public boolean reduceStock(BusinessActionContext businessActionContext, Long proId, Integer quantity) {
    if (Objects.nonNull(IdempotentUtil.getMarker(getClass(),businessActionContext.getXid()))){
        log.info("已执行过try阶段");
        return true;
    }
    //业务逻辑，省略...
    IdempotentUtil.addMarker(getClass(),businessActionContext.getXid(),"marker");
    return true;
}

@Override
@Transactional
public boolean commit(BusinessActionContext businessActionContext) {
    if (Objects.isNull(IdempotentUtil.getMarker(getClass(),businessActionContext.getXid()))){
        log.info("已执行过commit阶段");
        return true;
    }
   //业务逻辑，省略...
    log.info("减少库存：tcc二阶段commit成功");
    IdempotentUtil.removeMarker(getClass(),businessActionContext.getXid());
    return true;
}

@Override
@Transactional
public boolean rollback(BusinessActionContext businessActionContext) {
    if (Objects.isNull(IdempotentUtil.getMarker(getClass(),businessActionContext.getXid()))){
        log.info("已执行过rollback阶段");
        return true;
    }
    //业务逻辑，省略...
    log.info("减少库存：tcc二阶段回滚成功");
    IdempotentUtil.removeMarker(getClass(),businessActionContext.getXid());
    return true;
}
```

再次执行查看结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7aa7ed930ac14f6f9001ddd790d2edc1~tplv-k3u1fbpfcp-zoom-1.image)

可以看到跳过了第二次的commit阶段，保证了业务代码只执行一次。同样，我们在service中手动抛出一个异常，来测试本地事务失败的情况：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/491989ed4a554445a126e7b0542a8a31~tplv-k3u1fbpfcp-zoom-1.image)

可以看到也不会第二次执行rollback方法，避免了重复回滚的情况。幂等性问题是在使用Seata的TCC模式中格外需要被重视的问题，因为无论是网络数据的重传，或是异常事务的补偿执行，都有可能导致Try、Confirm、Cancel阶段的操作被重复执行。只有通过幂等性的校验，我们才能确保方法无论被重复执行多少次，都能保证同样的业务结果。