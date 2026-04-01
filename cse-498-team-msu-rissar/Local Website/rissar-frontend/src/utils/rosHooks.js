/**
 * rosHooks
 * 
 * custom react hooks for ros2 integration
 * 
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useROS } from './ROSContext';

// hook for subscribing to a ros topic
export function useROSTopic(topicName, messageType, throttleRate = 0) {
  const { connectionManager, connected } = useROS();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const topicRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let unsubscribe = null;

    if (!connected || !connectionManager || !topicName || !messageType) {
      setIsSubscribed(false);
      return () => { };
    }

    try {
      const topic = connectionManager.createTopic(topicName, messageType);
      topicRef.current = topic;

      const subscribeOptions = {};
      if (throttleRate > 0) {
        subscribeOptions.throttle_rate = throttleRate;
      }

      // Subscribe with optional throttling
      unsubscribe = topic.subscribe((msg) => {
        const now = Date.now();

        if (throttleRate > 0 && now - lastUpdateRef.current < throttleRate) {
          return;
        }

        lastUpdateRef.current = now;
        setMessage(msg);
        setError(null);
      }, subscribeOptions);

      setIsSubscribed(true);
      console.log(`subscribed to ${topicName}`);

      // Cleanup subscription
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
          console.log(`unsubscribed from ${topicName}`);
        }
        topicRef.current = null;
        setIsSubscribed(false);
      };
    } catch (err) {
      console.error(`error subscribing to ${topicName}:`, err);
      setError(err);
      setIsSubscribed(false);
      return () => { };
    }
  }, [connected, connectionManager, topicName, messageType, throttleRate]);

  return { message, error, isSubscribed };
}

// hook for publishing to a ros topic
export function useROSPublisher(topicName, messageType) {
  const { connectionManager, connected } = useROS();
  const topicRef = useRef(null);

  useEffect(() => {
    if (!connected || !connectionManager || !topicName || !messageType) {
      return;
    }

    try {
      const topic = connectionManager.createTopic(topicName, messageType);
      topicRef.current = topic;

      return () => {
        topicRef.current = null;
      };
    } catch (err) {
      console.error(`error creating publisher for ${topicName}:`, err);
    }
  }, [connected, connectionManager, topicName, messageType]);

  const publish = useCallback((message) => {
    if (topicRef.current && connected) {
      try {
        topicRef.current.publish(message);
      } catch (err) {
        console.error(`error publishing to ${topicName}:`, err);
      }
    } else {
      console.warn('cant publish: not connected');
    }
  }, [connected, topicName]);

  return publish;
}

// hook for calling ros services
export function useROSService(serviceName, serviceType) {
  const { connectionManager, connected } = useROS();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const serviceRef = useRef(null);

  useEffect(() => {
    if (!connected || !connectionManager || !serviceName || !serviceType) {
      return;
    }

    try {
      const service = connectionManager.createService(serviceName, serviceType);
      serviceRef.current = service;

      return () => {
        serviceRef.current = null;
      };
    } catch (err) {
      console.error(`error creating service client for ${serviceName}:`, err);
      setError(err);
    }
  }, [connected, connectionManager, serviceName, serviceType]);

  const callService = useCallback(async (request) => {
    if (!serviceRef.current || !connected) {
      const err = new Error('service not available');
      setError(err);
      return Promise.reject(err);
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      serviceRef.current.callService(
        request,
        (response) => {
          setResult(response);
          setLoading(false);
          resolve(response);
        },
        (err) => {
          console.error(`service call failed for ${serviceName}:`, err);
          setError(err);
          setLoading(false);
          reject(err);
        }
      );
    });
  }, [connected, serviceName]);

  return { callService, result, loading, error };
}

// hook for accessing ros parameters
export function useROSParam(paramName) {
  const { connectionManager, connected } = useROS();
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const paramRef = useRef(null);

  useEffect(() => {
    if (!connected || !connectionManager || !paramName) {
      return;
    }

    try {
      const param = connectionManager.createParam(paramName);
      paramRef.current = param;

      setLoading(true);
      param.get((val) => {
        setValue(val);
        setLoading(false);
      });

      return () => {
        paramRef.current = null;
      };
    } catch (err) {
      console.error(`error accessing parameter ${paramName}:`, err);
      setError(err);
      setLoading(false);
    }
  }, [connected, connectionManager, paramName]);

  const updateValue = useCallback((newValue) => {
    if (!paramRef.current || !connected) {
      const err = new Error('parameter not available');
      setError(err);
      return Promise.reject(err);
    }

    setLoading(true);
    return new Promise((resolve, reject) => {
      paramRef.current.set(
        newValue,
        () => {
          setValue(newValue);
          setLoading(false);
          resolve();
        },
        (err) => {
          console.error(`failed to set parameter ${paramName}:`, err);
          setError(err);
          setLoading(false);
          reject(err);
        }
      );
    });
  }, [connected, paramName]);

  return { value, setValue: updateValue, loading, error };
}

// hook for multiple topic subscriptions
export function useMultipleTopics(topics) {
  const { connectionManager, connected } = useROS();
  const [messages, setMessages] = useState({});
  const [errors, setErrors] = useState({});
  const [allSubscribed, setAllSubscribed] = useState(false);
  const topicsRef = useRef([]);

  useEffect(() => {
    if (!connected || !connectionManager || !topics || topics.length === 0) {
      setAllSubscribed(false);
      return;
    }

    const subscriptions = [];
    const newMessages = {};
    const newErrors = {};

    topics.forEach(({ name, type, throttleRate = 0 }) => {
      try {
        const topic = connectionManager.createTopic(name, type);

        const subscribeOptions = {};
        if (throttleRate > 0) {
          subscribeOptions.throttle_rate = throttleRate;
        }

        const unsubscribe = topic.subscribe((msg) => {
          setMessages(prev => ({ ...prev, [name]: msg }));
        }, subscribeOptions);

        subscriptions.push({ name, unsubscribe });
      } catch (err) {
        console.error(`error subscribing to ${name}:`, err);
        newErrors[name] = err;
      }
    });

    topicsRef.current = subscriptions;
    setMessages(newMessages);
    setErrors(newErrors);
    setAllSubscribed(subscriptions.length === topics.length);

    return () => {
      topicsRef.current.forEach(({ name, unsubscribe }) => {
        try {
          unsubscribe?.();
          console.log(`unsubscribed from ${name}`);
        } catch (err) {
          console.error(`error unsubscribing from ${name}:`, err);
        }
      });
      topicsRef.current = [];
      setAllSubscribed(false);
    };
  }, [connected, connectionManager, JSON.stringify(topics)]);

  return { messages, errors, allSubscribed };
}
