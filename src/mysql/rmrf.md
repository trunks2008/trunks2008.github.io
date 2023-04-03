---
title: 同事删库跑路后，我连表名都不能修改了？
icon: page
order: 2
author: Hydra
date: 2021-09-18
tag:
  - MySql
  - binlog
star: true
---



<!-- more -->

事情是这样的，前几天隔壁部门的哥们在生产环境的数据库上，执行了一下`drop`命令，好嘛，活生生的删库跑路的例子居然真的在我身边发生了，好在运维同学给力，后来恢复了数据。事后听说这哥们虽然没被开除，但也吃了个公司的警告。

再然后，运维那边回收了所有环境下数据库的`drop`命令的权限，甚至包括了开发环境，本来觉得对我们也没啥影响，一般我们也没有啥需要删表的需求。但是隔了没几天，我在重命名一个表的时候，突然弹出了这样一个报错：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/29dfd8d7b5a1443d93e2c83cc6fe55e6~tplv-k3u1fbpfcp-zoom-1.image)

仔细看了一眼报错：

```shell
1142 - DROP command denied to user 'hydra'@'localhost' for table 't_orders'
```

什么情况，重命名表和`drop`命令还有什么关系？本着怀疑的态度，就想探究一下没有`drop`权限后，对我们的日常数据库操作都有什么影响，于是就有了后面一系列在本地进行的测试。

首先需要一个没有`drop`权限的mysql用户，我们先在本地环境使用root用户登录mysql，取消用户hydra的`drop`权限。和`grant`授权命令相对应的，可以使用`revoke`命令取消对用户的授权：

```sql
revoke drop on *.* from hydra@'localhost';
```

好了，准备工作做完了，It's show time~

### 修改表名

前面直接使用navicat来修改表名失败，那我们再用sql命令来尝试一下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/13dd8f2ea2df4b878dea83e2abda0d9f~tplv-k3u1fbpfcp-zoom-1.image)

上面测试了两种重命名表的命令，无论是`ALTER`还是`RENAME`都不能正常使用，看来`drop`的权限确实会对修改表名造成影响。至于重命名失败的原因，看一下官方文档的说明：

> RENAME TABLE renames one or more tables. You must have ALTER and DROP privileges for the original table, and CREATE and INSERT privileges for the new table.

简单来说就是在重命名表时，必须有原始表的`ALTER`和`DROP`权限，以及新表的`CREATE`和`INSERT`权限。

### truncate

当我需要清空一张表、顺带把`AUTO_INCREMENT`的主键置为初始值时，突然发现`truncate`命令也无法执行了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4f58f1bda8c4a1d88e5146ad66ca8f1~tplv-k3u1fbpfcp-zoom-1.image)

有了上面的经验，还是看一下官方文档的说明：

> Although TRUNCATE TABLE is similar to DELETE, it is classified as a DDL statement rather than a DML statement. It differs from DELETE in the following ways:
>
> Truncate operations drop and re-create the table, which is much faster than deleting rows one by one, particularly for large tables.

文档给出的解释是尽管`truncate`和`delete`的功能很像，但是`truncate`被归类为DDL语言，而`delete`则是DML语言。相对于`delete`一行行删除数据，`truncate`会**删除**表后重新**新建表**，这一操作相对`delete`会快很多，尤其是对大表而言。

从分类也可以看出两者之间的不同，DML(`data manipulation language`)作为数据操作语言，主要是针对数据进行一些操作，例如常用的增删改查。而DDL(`data definition language`)则是数据定义语言，主要应用于定义或改变表的结构等操作，并且这一操作过程是隐性提交的，不能回滚。

在`truncate`无法使用的情况下，来执行一下`delete`试试：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/06980e38bb5d425c96f5d6e2a6ab2efd~tplv-k3u1fbpfcp-zoom-1.image)

虽然说不带`where`条件的`delete`删除语句很不推荐使用，但是在功能上还是可以执行成功的。那么再看看另一个问题，表中的自增`id`重置了吗？

我们知道，如果执行了`truncate`的话，那么自增列`id`的值会被重置为1。下面看看`delete`执行后的情况，插入一条数据并查询：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c9ebbd0999484472b387c87d64c0d93c~tplv-k3u1fbpfcp-zoom-1.image)

通过上面的结果，可以看到使用`delete`清表后，自增列的值还是在原先的基础上进行自增。如果需要重置这个值的话，需要我们手动在表上执行`alter`命令修改：

```sql
alter table t_orders auto_increment= 1;
```

### drop作用范围

那么，是否存在即使在没有权限的情况下，也可以执行成功的`drop`指令？我们对不同对象分别进行测试，首先尝试对数据库、表、视图的`drop`操作：

```sql
drop DATABASE mall;
> 1044 - Access denied for user 'hydra'@'localhost' to database 'mall'
> 时间: 0.005s

drop TABLE t_orders;
> 1142 - DROP command denied to user 'hydra'@'localhost' for table 't_orders'
> 时间: 0s

drop VIEW order_view;
> 1142 - DROP command denied to user 'hydra'@'localhost' for table 'order_view'
> 时间: 0.001s
```

上面这些命令理所当然的没有执行成功，但是在尝试到使用`drop`删除存储过程时，意料之外的结果出现了。在没有`drop`权限的情况下，对存储过程的`drop`操作，居然可以执行成功：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1d479cbec3bc49f583f4d2e7b0460470~tplv-k3u1fbpfcp-zoom-1.image)

翻到官方文档中授权这一章节，看一下这张图就明白了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/957c4bfab04649dab3ba7b62190f619d~tplv-k3u1fbpfcp-zoom-1.image)

上面的表进行了解释，`drop`命令的作用范围仅仅是数据库、表以及视图，而存储过程的权限被单独放在`alter routine`中了，因此即使没有`drop`权限，我们仍可以用`drop`命令来删除存储过程。

### delete后如何恢复数据

通过前面的实验可以看到，虽然在回收`drop`权限后不能使用`truncate`清空数据表了，但我们仍然可以使用`delete`语句达到相同的效果，那么为什么`delete`就不害怕删库的风险呢？

前面我们提到过，`delete`语句属于DML语言，其实在实际的删除过程中是一行行的进行删除的，并且会将每行数据的删除日志记录在日志中，下面我们就看看如何利用`binlog`来恢复删除的数据。

首先要求数据库开启`binlog`，使用下面的语句来查询是否开启：

```sql
show variables like '%log_bin%';
```

在值为`ON`的情况下，表示开启了`binglog`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d29fecc67aa046cdb63065ffb05386cf~tplv-k3u1fbpfcp-zoom-1.image)

确保开启了`binlog`后，我们使用`delete`来删除表中的全部数据：

```sql
delete from t_orders;
```

在恢复删除的数据前，需要先找到存放数据文件的目录：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/652166f391d14fd284b1e8b01db50695~tplv-k3u1fbpfcp-zoom-1.image)

在该目录下，存在若干名称为`mysql-bin.*****`的文件，我们需要根据删除操作发生的时间找到临近的`binglog`文件：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8c26a22274b645298426934b7ef8255b~tplv-k3u1fbpfcp-zoom-1.image)

找到目标`binlog`文件后，这里先将它拷贝到`D:\tmp`目录下，然后到mysql安装目录的`bin`目录下，执行下面的指令：

```shell
mysqlbinlog --base64-output=decode-rows -v --database=mall --start-datetime="2021-09-17 20:50:00" --stop-datetime="2021-09-17 21:30:00" D:\tmp\mysql-bin.000001 > mysqllog.sql
```

对参数进行一下说明：

- `base64-output=decode-rows`：基于行事件解析成sql语句，并将数据转换正常的字符
- `database`：数据库名
- `start-datetime`：从binlog中第一个等于或晚于该时间戳的事件开始读取，也就是恢复数据的起始时间
- `stop-datetime`：与上面对应的，是恢复数据的结束时间
- `D:\tmp\mysql-bin.000001`：恢复数据的日志文件
- `mysqllog.sql`：恢复数据的输出文件

执行完成后，在`bin`目录下会生成一个`mysqllog.sql`的文件，打开文件看一下，可以找到删除时执行的`delete`语句：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3b2fd7e49b8548348368f981a730c5ac~tplv-k3u1fbpfcp-zoom-1.image)

从语句中可以拿到`delete`命令执行时每一行数据的值，这样就可以进行数据的恢复了。如果需要恢复的数据量非常大的话，建议使用脚本批量将`delete`语句转换为`insert`语句，减轻恢复数据的工作量。

好了，如果你坚持看到这里，答应我，以后删库前，先看一下有没有开启binlog好吗？

> 官方文档：https://dev.mysql.com/doc/refman/5.7/en