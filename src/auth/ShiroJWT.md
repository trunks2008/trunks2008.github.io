---
title: Shiro整合JWT实战
icon: page
order: 1
author: Hydra
date: 2020-09-26
tag:
  - Shiro
  - JWT
star: true
---



<!-- more -->

JSON Web Token（`JWT`）是为了在网络应用间传递声明而执行的一种基于JSON的开放标准。JWT的声明一般被用来在身份提供者和服务提供者间传递被认证的用户身份信息，以便于从资源服务器获取资源。token可以直接被用于认证，也可被加密。

我们在`springboot`+`shiro`的基础上，整合jwt模块，对其进行扩展，实现无状态认证加鉴权。

JWT实现认证思路：

- 因为要实现无状态，所以jwt需要关闭shiro的`session`管理
- 用户第一次登录成功时，使用jwt返回`token`
- 在后续的请求中携带`token`，每次请求都会对`token`携带的用户信息进行验证，并完成后续认证和鉴权

1、导入Maven依赖：

```xml
<dependency>
    <groupId>org.apache.shiro</groupId>
    <artifactId>shiro-spring</artifactId>
    <version>1.5.3</version>
</dependency>

<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>java-jwt</artifactId>
    <version>3.7.0</version>
</dependency>
```

2、封装`JwtToken`来替换shiro的原生token，需要实现`AuthenticationToken` 接口：

 ```java
public class JwtToken implements AuthenticationToken {
    private final String token;

    public JwtToken(String token) {
        this.token = token;
    }

    @Override
    public Object getPrincipal() {
        return token;
    }

    @Override
    public Object getCredentials() {
        return token;
    }
}
 ```

3、添加一个工具类`JwtUtil`来操作token：

 ```java
public class JwtUtil {
    public static final String ACCOUNT = "username";
    public static final long EXPIRE_TIME = 30 * 60 * 1000;

    public static boolean verify(String token, String username, String secret) {
        try{
            Algorithm algorithm = Algorithm.HMAC256(secret);
            JWTVerifier verifier = JWT.require(algorithm)
                    .withClaim(ACCOUNT, username)
                    .build();

            DecodedJWT jwt = verifier.verify(token);
            return true;
        }catch (Exception e){
            e.printStackTrace();
            return false;
        }
    }

    public static String getClaimField(String token,String claim){
        try{
            DecodedJWT jwt = JWT.decode(token);
            return jwt.getClaim(claim).asString();
        }catch (JWTDecodeException e){
            e.printStackTrace();
            return  null;
        }
    }
    
    public static String sign(String username, String secret) {
        Date date = new Date(System.currentTimeMillis() + EXPIRE_TIME);
        Algorithm algorithm = Algorithm.HMAC256(secret);
        return JWT.create()
                .withClaim(ACCOUNT, username)
                .withExpiresAt(date)
                .sign(algorithm);
    }
}
 ```

在`JwtUtil`类中主要提供了三个方法：

- `sign`方法用于生成附带过期时间的签名，创建过程中可以在`claim`中存放一些信息，通常可以用来携带用户信息
- `verify`方法中，根据密码生成jwt校验器，校验token是否正确，和`sign`方法使用相同的加密方式
- `getClaimField`方法用于获得token中指定字段的信息

4、添加`JwtFilter` 拦截器，继承`AccessControlFilter` 类，验证从请求的`header`中取出的token信息：

```java
public class JwtFilter extends AccessControlFilter {
    public static String ACCESS_TOKEN = "Access-Token";

    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue) throws Exception {
        return false;
    }

    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) throws Exception {
        HttpServletRequest req = (HttpServletRequest) request;
        // 解决跨域问题
        if(HttpMethod.OPTIONS.toString().matches(req.getMethod())) {
            return true;
        }
        if (isLoginAttempt(request, response)) {
            JwtToken token = new JwtToken(req.getHeader(ACCESS_TOKEN));
            try {
                getSubject(request, response).login(token);
                return true;
            } catch (Exception e) {
            }
        }
        onLoginFail(response);
        return false;
    }

    protected boolean isLoginAttempt(ServletRequest request, ServletResponse response) {
        HttpServletRequest req = (HttpServletRequest) request;
        String authorization = req.getHeader(ACCESS_TOKEN);
        return authorization != null;
    }

    //登录失败时默认返回401状态码
    private void onLoginFail(ServletResponse response) throws IOException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        httpResponse.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        httpResponse.setContentType("application/json;charset=utf-8");
        httpResponse.getWriter().write("login fail");
    }
}
```

这里首先会调用`isAccessAllowed`方法，均会返回`false`，之后所有权限认证统一调用`onAccessDenied`方法进行处理。在`onAccessDenied`方法中，会从请求的header中拿出token并尝试登录验证。

5、创建`JwtRealm` 继承`AuthorizingRealm` 类，`Realm`中实现了shiro认证的主要功能，主要包括**认证**和**鉴权**两个方面：

```java
public class JwtRealm extends AuthorizingRealm {
    @Autowired
    private UserService userService;

    @Override
    public boolean supports(AuthenticationToken token) {
        return token instanceof JwtToken;
    }

    @Override
    protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principals) {
        String username = principals.toString();
        SimpleAuthorizationInfo simpleAuthorizationInfo = new SimpleAuthorizationInfo();
        simpleAuthorizationInfo.addRoles(userService.getRoles(username));
        simpleAuthorizationInfo.addStringPermissions(userService.getPermissions(username));
        return simpleAuthorizationInfo;
    }

    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken authenticationToken) throws AuthenticationException {
        String token = (String) authenticationToken.getCredentials();    
        String userName = null;
        try {
            userName = JwtUtil.getClaimField(token, JwtUtil.ACCOUNT);
            User user = userService.getUserByName(userName);
            if (user == null) {
                System.out.println("用户不存在");
                return null;
            }

            boolean verify = JwtUtil.verify(token, userName, user.getPassword());
            if (!verify) {
                System.out.println("Token校验不正确");
                return null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        SimpleAuthenticationInfo authenticationInfo = new SimpleAuthenticationInfo(
                userName,token,getName());
        return authenticationInfo;
    }
}
```

在类`JwtRealm` 中，`doGetAuthenticationInfo`用于校验认证，而`doGetAuthorizationInfo`用于返回用户的权限。至于具体的查看用户是否存在和获取用户权限部分，放在`UserService`中实现。

6、创建`JwtSubjectFactory` ，关闭session：

```java
public class JwtSubjectFactory extends DefaultWebSubjectFactory {
    @Override
    public Subject createSubject(SubjectContext context) {
        context.setSessionCreationEnabled(false);
        return super.createSubject(context);
    }
}
```

7、创建`ShiroConfig`进行配置，这里除了配置shiro自身三个核心组件`filter`、`realm`、`securityManager`的注入外，还关闭了shiro的会话管理，注入`Subject`工厂，以及开启对shiro注解的支持：

```java
@Configuration
public class ShiroConfig {
    @Bean
    public ShiroFilterFactoryBean shiroFilter(@Qualifier("defaultWebSecurityManager") DefaultWebSecurityManager webSecurityManager){
        ShiroFilterFactoryBean shiroFilterFactoryBean = new ShiroFilterFactoryBean();
        shiroFilterFactoryBean.setSecurityManager(webSecurityManager);

        Map<String,String> filterChainDefinitionMap=new LinkedHashMap<>();
        filterChainDefinitionMap.put("/toLogin","anon");
        shiroFilterFactoryBean.setLoginUrl("/login");
        shiroFilterFactoryBean.setSuccessUrl("/index");

        //shiro自定义过滤器
        Map<String, Filter> filters = new LinkedHashMap<>();
        filters.put("jwt", new JwtFilter());
        shiroFilterFactoryBean.setFilters(filters);
        filterChainDefinitionMap.put("/**","jwt");

        shiroFilterFactoryBean.setFilterChainDefinitionMap(filterChainDefinitionMap);
        return shiroFilterFactoryBean;
    }

    @Bean
    public DefaultWebSessionManager sessionManager() {
        DefaultWebSessionManager defaultSessionManager = new DefaultWebSessionManager();
        defaultSessionManager.setSessionValidationSchedulerEnabled(false);
        return defaultSessionManager;
    }

    @Bean
    public DefaultWebSubjectFactory subjectFactory() {
        return new JwtSubjectFactory();
    }

    @Bean(name = "defaultWebSecurityManager")
    public DefaultWebSecurityManager defaultWebSecurityManager(@Qualifier("realm") JwtRealm realm,
                     SubjectFactory subjectFactory, SessionManager sessionManager){
        DefaultWebSecurityManager webSecurityManager=new DefaultWebSecurityManager();
        webSecurityManager.setRealm(realm);

        //关闭shiro自带的session
        DefaultSubjectDAO subjectDAO = new DefaultSubjectDAO();
        DefaultSessionStorageEvaluator defaultSessionStorageEvaluator = new DefaultSessionStorageEvaluator();
        defaultSessionStorageEvaluator.setSessionStorageEnabled(false);
        subjectDAO.setSessionStorageEvaluator(defaultSessionStorageEvaluator);
        webSecurityManager.setSubjectDAO(subjectDAO);

        webSecurityManager.setSubjectFactory(subjectFactory);
        webSecurityManager.setSessionManager(sessionManager);
        return webSecurityManager;
    }

    @Bean(name = "realm")
    public JwtRealm myRealm(){
        return new JwtRealm();
    }

    @Bean
    public LifecycleBeanPostProcessor lifecycleBeanPostProcessor() {
        return new LifecycleBeanPostProcessor();
    }

    @Bean
    @DependsOn({"lifecycleBeanPostProcessor"})
    public DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator() {
        DefaultAdvisorAutoProxyCreator advisorAutoProxyCreator = new DefaultAdvisorAutoProxyCreator();
        advisorAutoProxyCreator.setProxyTargetClass(true);
        return advisorAutoProxyCreator;
    }

    @Bean
    public AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor(SecurityManager securityManager) {
        AuthorizationAttributeSourceAdvisor authorizationAttributeSourceAdvisor = new AuthorizationAttributeSourceAdvisor();
        authorizationAttributeSourceAdvisor.setSecurityManager(securityManager);
        return authorizationAttributeSourceAdvisor;
    }
}
```

需要注意，不要通过注解的方式直接把自定义的`JwtFilter`注入到spring容器中，而是在`ShiroFilter`中注入`JwtFilter`并使用它拦截一切非匿名访问的请求。

8、实现登录逻辑，验证密码是否正确，登录成功后返回签发的token：

```java
@Controller
public class LoginController {
    @Autowired
    UserService userService;

    @ResponseBody
    @PostMapping(value = "toLogin")
    public Result<JSONObject> login(String username, String password) {
        Result<JSONObject> result = new Result<>();
        JSONObject json = new JSONObject();

        User user = userService.getUserByName(username);
        if (user == null) {
            json.put("error", "用户不存在");
            result.setData(json);
            return result;
        }

        if (!user.getPassword().equals(password)) {
            json.put("error", "密码不正确");
            result.setData(json);
            return result;
        }

        String token = JwtUtil.sign(username, password);
        json.put("token", token);
        result.setData(json);
        return result;
    }
}
```

9、定义测试接口，并定义接口访问权限：

 ```java
@RestController
public class TestController {
    @GetMapping("test1")
    @RequiresRoles("admin")
    @RequiresPermissions("user:add")
    public String test(){
        return "test1";
    }

    @GetMapping("test2")
    @RequiresPermissions("other:copy")
    public String test2(){
        return "test2";
    }

    @GetMapping("test3")
    @RequiresRoles("guest")
    @RequiresPermissions("other:check")
    public String test3(){
        return "test3";
    }
}
 ```

10、使用postman进行测试，登录成功后会返回token：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d364f75327fa478db8587096642d3f91~tplv-k3u1fbpfcp-zoom-1.image)

调用接口时携带刚才返回的token，调用成功并返回结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eabb876bcbd142ef9fa061982d466b53~tplv-k3u1fbpfcp-zoom-1.image)

访问没有权限的接口，shiro会对其进行拦截：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f232ef70c4734deb850fd04857ab67f0~tplv-k3u1fbpfcp-zoom-1.image)

到这里，简单的shiro整合jwt就完成了。