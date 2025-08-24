/**
 * Service Discovery and Load Balancing System
 * 
 * 基于 Linus "好品味" 设计原则：
 * 1. 消除特殊情况 - 统一的服务注册和发现机制
 * 2. 数据结构优先 - 用 Map 管理服务状态，避免条件分支地狱  
 * 3. 实用主义 - 解决真实的多服务实例问题
 */

export class ServiceDiscovery {
  constructor(options = {}) {
    // 核心数据结构：服务状态的唯一真实来源
    this.services = new Map(); // serviceName -> ServiceInfo[]
    this.healthChecks = new Map(); // serviceId -> HealthCheckConfig
    this.loadBalancers = new Map(); // serviceName -> LoadBalancer
    this.metrics = new Map(); // serviceId -> ServiceMetrics
    
    // 配置参数
    this.config = {
      healthCheckInterval: options.healthCheckInterval || 5000,
      serviceTimeout: options.serviceTimeout || 10000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // 服务发现策略
    this.discoveryStrategies = {
      'port-scan': this.discoverByPortScan.bind(this),
      'process-list': this.discoverByProcessList.bind(this),
      'config-file': this.discoverByConfigFile.bind(this)
    };
    
    this.isRunning = false;
  }

  /**
   * 注册服务 - 消除特殊情况的统一注册机制
   */
  async registerService(serviceName, serviceConfig) {
    const serviceId = this.generateServiceId(serviceName, serviceConfig);
    
    const serviceInfo = {
      id: serviceId,
      name: serviceName,
      host: serviceConfig.host || 'localhost',
      port: serviceConfig.port,
      protocol: serviceConfig.protocol || 'http',
      path: serviceConfig.path || '/',
      weight: serviceConfig.weight || 1,
      status: 'unknown',
      registeredAt: Date.now(),
      lastHealthCheck: null,
      metadata: serviceConfig.metadata || {}
    };

    // 添加到服务列表
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, []);
    }
    
    const serviceList = this.services.get(serviceName);
    const existingIndex = serviceList.findIndex(s => s.id === serviceId);
    
    if (existingIndex >= 0) {
      serviceList[existingIndex] = { ...serviceList[existingIndex], ...serviceInfo };
    } else {
      serviceList.push(serviceInfo);
    }

    // 配置健康检查
    this.setupHealthCheck(serviceId, serviceConfig.healthCheck);
    
    // 初始化负载均衡器
    this.setupLoadBalancer(serviceName, serviceConfig.loadBalance);
    
    // 初始化指标收集
    this.initializeMetrics(serviceId);
    
    console.log(`Service registered: ${serviceName}:${serviceConfig.port} (${serviceId})`);
    
    return serviceId;
  }

  /**
   * 自动服务发现 - 实用主义：只发现真正需要的服务
   */
  async discoverServices(strategies = ['port-scan', 'process-list']) {
    const discoveredServices = new Map();
    
    for (const strategy of strategies) {
      if (this.discoveryStrategies[strategy]) {
        try {
          const services = await this.discoveryStrategies[strategy]();
          for (const [name, config] of services.entries()) {
            discoveredServices.set(name, config);
          }
        } catch (error) {
          console.warn(`Discovery strategy ${strategy} failed:`, error.message);
        }
      }
    }
    
    // 自动注册发现的服务
    for (const [name, config] of discoveredServices.entries()) {
      await this.registerService(name, config);
    }
    
    return discoveredServices;
  }

  /**
   * 获取健康的服务实例 - 负载均衡核心逻辑
   */
  async getHealthyService(serviceName, options = {}) {
    const serviceList = this.services.get(serviceName);
    if (!serviceList || serviceList.length === 0) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const healthyServices = serviceList.filter(service => 
      service.status === 'healthy' || service.status === 'unknown'
    );

    if (healthyServices.length === 0) {
      throw new Error(`No healthy instances of service ${serviceName}`);
    }

    // 使用负载均衡算法选择服务
    const loadBalancer = this.loadBalancers.get(serviceName);
    const selectedService = loadBalancer ? 
      loadBalancer.select(healthyServices, options) : 
      this.selectByRoundRobin(healthyServices);

    // 记录选择指标
    this.recordSelection(selectedService.id);
    
    return selectedService;
  }

  /**
   * 启动服务监控
   */
  async startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 定期健康检查
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    // 定期服务发现
    this.discoveryTimer = setInterval(() => {
      this.discoverServices().catch(err => {
        console.warn('Periodic service discovery failed:', err.message);
      });
    }, this.config.healthCheckInterval * 6); // 每30秒发现一次
    
    console.log('Service discovery monitoring started');
  }

  /**
   * 停止服务监控
   */
  stopMonitoring() {
    this.isRunning = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    
    console.log('Service discovery monitoring stopped');
  }

  // === 私有方法：核心算法实现 ===

  /**
   * 设置健康检查 - 好品味：用配置驱动行为
   */
  setupHealthCheck(serviceId, healthCheckConfig) {
    const defaultConfig = {
      type: 'http',
      path: '/health',
      method: 'GET',
      timeout: 5000,
      interval: this.config.healthCheckInterval,
      retries: this.config.maxRetries
    };
    
    const config = { ...defaultConfig, ...healthCheckConfig };
    this.healthChecks.set(serviceId, config);
  }

  /**
   * 设置负载均衡器
   */
  setupLoadBalancer(serviceName, loadBalanceConfig) {
    const algorithm = loadBalanceConfig?.algorithm || 'round-robin';
    
    const loadBalancerFactory = {
      'round-robin': () => new RoundRobinBalancer(),
      'weighted': () => new WeightedBalancer(),
      'least-connections': () => new LeastConnectionsBalancer(),
      'response-time': () => new ResponseTimeBalancer()
    };
    
    const balancer = loadBalancerFactory[algorithm]?.() || new RoundRobinBalancer();
    this.loadBalancers.set(serviceName, balancer);
  }

  /**
   * 执行健康检查
   */
  async performHealthChecks() {
    const healthCheckPromises = [];
    
    for (const [serviceId, healthCheckConfig] of this.healthChecks.entries()) {
      const service = this.findServiceById(serviceId);
      if (service) {
        healthCheckPromises.push(
          this.performSingleHealthCheck(service, healthCheckConfig)
            .catch(error => ({
              serviceId,
              status: 'unhealthy',
              error: error.message,
              timestamp: Date.now()
            }))
        );
      }
    }
    
    const results = await Promise.all(healthCheckPromises);
    
    // 更新服务状态
    for (const result of results) {
      this.updateServiceStatus(result.serviceId, result.status, result);
    }
  }

  /**
   * 单个服务健康检查
   */
  async performSingleHealthCheck(service, healthCheckConfig) {
    const startTime = Date.now();
    
    try {
      const response = await this.makeHealthCheckRequest(service, healthCheckConfig);
      const responseTime = Date.now() - startTime;
      
      const isHealthy = response.status >= 200 && response.status < 300;
      
      return {
        serviceId: service.id,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        details: {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        serviceId: service.id,
        status: 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * 发起健康检查请求
   */
  async makeHealthCheckRequest(service, healthCheckConfig) {
    const url = `${service.protocol}://${service.host}:${service.port}${healthCheckConfig.path}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), healthCheckConfig.timeout);
    
    try {
      const response = await fetch(url, {
        method: healthCheckConfig.method,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Gmail-MCP-Service-Discovery/1.0'
        }
      });
      
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * 通过端口扫描发现服务
   */
  async discoverByPortScan() {
    const commonPorts = [3456, 3457, 3458, 8080, 8081, 8082];
    const discoveredServices = new Map();
    
    for (const port of commonPorts) {
      try {
        const response = await fetch(`http://localhost:${port}/health`, {
          method: 'GET',
          timeout: 2000
        });
        
        if (response.ok) {
          const serviceInfo = await response.json().catch(() => ({}));
          const serviceName = serviceInfo.service || `service-${port}`;
          
          discoveredServices.set(serviceName, {
            host: 'localhost',
            port,
            protocol: 'http',
            metadata: serviceInfo
          });
        }
      } catch (error) {
        // 端口未开放或服务不存在，忽略错误
      }
    }
    
    return discoveredServices;
  }

  /**
   * 通过进程列表发现服务
   */
  async discoverByProcessList() {
    // 实现进程发现逻辑
    // 这里是简化版本，实际应该扫描系统进程
    return new Map();
  }

  /**
   * 通过配置文件发现服务
   */
  async discoverByConfigFile() {
    // 实现配置文件扫描逻辑
    return new Map();
  }

  // === 辅助方法 ===

  generateServiceId(serviceName, config) {
    return `${serviceName}-${config.host}-${config.port}`;
  }

  findServiceById(serviceId) {
    for (const serviceList of this.services.values()) {
      const service = serviceList.find(s => s.id === serviceId);
      if (service) return service;
    }
    return null;
  }

  updateServiceStatus(serviceId, status, details = {}) {
    const service = this.findServiceById(serviceId);
    if (service) {
      service.status = status;
      service.lastHealthCheck = details.timestamp || Date.now();
      service.lastResponseTime = details.responseTime;
      
      // 更新指标
      this.updateMetrics(serviceId, details);
    }
  }

  initializeMetrics(serviceId) {
    this.metrics.set(serviceId, {
      totalRequests: 0,
      successfulRequests: 0,
      avgResponseTime: 0,
      responseTimes: [],
      lastUsed: null
    });
  }

  updateMetrics(serviceId, details) {
    const metrics = this.metrics.get(serviceId);
    if (metrics && details.responseTime) {
      metrics.responseTimes.push(details.responseTime);
      
      // 只保留最近100个响应时间记录
      if (metrics.responseTimes.length > 100) {
        metrics.responseTimes.shift();
      }
      
      metrics.avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
    }
  }

  recordSelection(serviceId) {
    const metrics = this.metrics.get(serviceId);
    if (metrics) {
      metrics.totalRequests++;
      metrics.lastUsed = Date.now();
    }
  }

  selectByRoundRobin(services) {
    // 简单轮询选择
    const now = Date.now();
    let selected = services[0];
    let oldestUsage = Infinity;
    
    for (const service of services) {
      const metrics = this.metrics.get(service.id);
      const lastUsed = metrics?.lastUsed || 0;
      
      if (lastUsed < oldestUsage) {
        oldestUsage = lastUsed;
        selected = service;
      }
    }
    
    return selected;
  }

  /**
   * 获取系统状态概览
   */
  getSystemOverview() {
    const overview = {
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      servicesByType: {},
      avgResponseTime: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const [serviceName, serviceList] of this.services.entries()) {
      overview.totalServices += serviceList.length;
      overview.servicesByType[serviceName] = serviceList.length;

      for (const service of serviceList) {
        if (service.status === 'healthy') {
          overview.healthyServices++;
        } else if (service.status === 'unhealthy') {
          overview.unhealthyServices++;
        }

        if (service.lastResponseTime) {
          totalResponseTime += service.lastResponseTime;
          responseTimeCount++;
        }
      }
    }

    if (responseTimeCount > 0) {
      overview.avgResponseTime = Math.round(totalResponseTime / responseTimeCount);
    }

    return overview;
  }
}

// === 负载均衡器实现 ===

class RoundRobinBalancer {
  constructor() {
    this.currentIndex = 0;
  }

  select(services) {
    if (services.length === 0) return null;
    
    const selected = services[this.currentIndex % services.length];
    this.currentIndex++;
    return selected;
  }
}

class WeightedBalancer {
  select(services) {
    if (services.length === 0) return null;
    
    const totalWeight = services.reduce((sum, service) => sum + service.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const service of services) {
      random -= service.weight;
      if (random <= 0) {
        return service;
      }
    }
    
    return services[0];
  }
}

class LeastConnectionsBalancer {
  select(services) {
    if (services.length === 0) return null;
    
    // 选择连接数最少的服务（这里用请求数代替）
    let selected = services[0];
    let minRequests = Infinity;
    
    for (const service of services) {
      const requests = service.metadata?.activeConnections || 0;
      if (requests < minRequests) {
        minRequests = requests;
        selected = service;
      }
    }
    
    return selected;
  }
}

class ResponseTimeBalancer {
  select(services) {
    if (services.length === 0) return null;
    
    // 选择响应时间最短的服务
    let selected = services[0];
    let minResponseTime = Infinity;
    
    for (const service of services) {
      const responseTime = service.lastResponseTime || Infinity;
      if (responseTime < minResponseTime) {
        minResponseTime = responseTime;
        selected = service;
      }
    }
    
    return selected;
  }
}

export default ServiceDiscovery;