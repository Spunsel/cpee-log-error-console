/**
 * Performance Monitoring System
 * Tracks application performance and provides optimization insights
 */

export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
        this.isEnabled = false;
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        this.isEnabled = true;
        this.setupObservers();
        console.log('📊 Performance monitoring enabled');
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        this.isEnabled = false;
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }

    /**
     * Start timing a performance metric
     */
    startTiming(name) {
        if (!this.isEnabled) return;
        
        this.metrics.set(name, {
            startTime: performance.now(),
            endTime: null,
            duration: null
        });
    }

    /**
     * End timing a performance metric
     */
    endTiming(name) {
        if (!this.isEnabled) return;
        
        const metric = this.metrics.get(name);
        if (metric) {
            metric.endTime = performance.now();
            metric.duration = metric.endTime - metric.startTime;
            
            console.log(`⏱️ ${name}: ${metric.duration.toFixed(2)}ms`);
            return metric.duration;
        }
    }

    /**
     * Measure function execution time
     */
    async measureFunction(name, fn) {
        if (!this.isEnabled) return await fn();
        
        this.startTiming(name);
        try {
            const result = await fn();
            this.endTiming(name);
            return result;
        } catch (error) {
            this.endTiming(name);
            throw error;
        }
    }

    /**
     * Measure network request performance
     */
    measureNetworkRequest(url) {
        if (!this.isEnabled) return null;
        
        const startTime = performance.now();
        
        return {
            complete: (success = true, size = 0) => {
                const duration = performance.now() - startTime;
                console.log(`🌐 Network: ${url} - ${duration.toFixed(2)}ms (${size} bytes) - ${success ? '✅' : '❌'}`);
                
                return {
                    url,
                    duration,
                    success,
                    size,
                    timestamp: new Date()
                };
            }
        };
    }

    /**
     * Get memory usage information
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
            };
        }
        return null;
    }

    /**
     * Get all performance metrics
     */
    getMetrics() {
        const metrics = {};
        this.metrics.forEach((value, key) => {
            metrics[key] = value;
        });
        
        return {
            timing: metrics,
            memory: this.getMemoryUsage(),
            navigation: this.getNavigationTiming(),
            resources: this.getResourceTiming()
        };
    }

    /**
     * Get navigation timing
     */
    getNavigationTiming() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (!navigation) return null;
        
        return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: this.getFirstPaint(),
            timeToInteractive: this.getTimeToInteractive()
        };
    }

    /**
     * Get resource timing
     */
    getResourceTiming() {
        return performance.getEntriesByType('resource').map(resource => ({
            name: resource.name,
            duration: resource.duration,
            size: resource.transferSize,
            type: this.getResourceType(resource.name)
        }));
    }

    /**
     * Setup performance observers
     */
    setupObservers() {
        // Long Task Observer
        if ('PerformanceObserver' in window) {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    console.warn(`🐌 Long task detected: ${entry.duration.toFixed(2)}ms`);
                });
            });
            
            try {
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.push(longTaskObserver);
            } catch (e) {
                console.log('Long task observer not supported');
            }

            // Layout Shift Observer
            const layoutShiftObserver = new PerformanceObserver((list) => {
                let cumulativeScore = 0;
                list.getEntries().forEach((entry) => {
                    cumulativeScore += entry.value;
                });
                
                if (cumulativeScore > 0.1) {
                    console.warn(`📐 Layout shift detected: ${cumulativeScore.toFixed(4)}`);
                }
            });
            
            try {
                layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.push(layoutShiftObserver);
            } catch (e) {
                console.log('Layout shift observer not supported');
            }
        }
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getTimeToInteractive() {
        // Simplified TTI calculation
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? navigation.domInteractive : null;
    }

    getResourceType(url) {
        if (url.endsWith('.js')) return 'script';
        if (url.endsWith('.css')) return 'stylesheet';
        if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return 'image';
        if (url.includes('font') || url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
        return 'other';
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const metrics = this.getMetrics();
        
        console.group('📊 Performance Report');
        console.log('Memory Usage:', metrics.memory);
        console.log('Navigation Timing:', metrics.navigation);
        console.log('Custom Metrics:', metrics.timing);
        console.log('Resource Loading:', metrics.resources);
        console.groupEnd();
        
        return metrics;
    }
}
