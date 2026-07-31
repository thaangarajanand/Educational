export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'article' | 'lab' | 'quiz';
  videoUrl?: string;
  content: string;
  keyTakeaways: string[];
  codeSnippet?: string;
  diagramUrl?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  duration: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  category: 'Robotics' | 'Computer Science' | 'Physics' | 'Mathematics' | 'Electrical';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  description: string;
  instructor: string;
  rating: number;
  enrolledCount: number;
  coverImage: string;
  modules: CourseModule[];
}

export const mockCourses: Course[] = [
  {
    id: 'course-robotics-101',
    title: 'Autonomous Robotics & Microcontroller Architecture',
    category: 'Robotics',
    level: 'Intermediate',
    duration: '6 Hours • 4 Modules',
    description: 'Master autonomous mobile robots, LiDAR telemetry integration, PID closed-loop motor control algorithms, and RTOS embedded programming.',
    instructor: 'Dr. Thangaraj & AI Robotics Lab',
    rating: 4.9,
    enrolledCount: 1420,
    coverImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1: Fundamentals of Autonomous Mobile Systems',
        duration: '1h 30m',
        lessons: [
          {
            id: 'les-1-1',
            title: '1.1 System Architecture & Telemetry Overview',
            duration: '25m',
            type: 'article',
            content: `### System Architecture Overview

Autonomous robotics combines real-time sensor feedback (LiDAR, ultrasonic, IMU), microcontroller logic processing (ESP32, STM32, ARM Cortex-M), and high-frequency PWM motor control.

#### Key Architectural Layers:
1. **Perception Layer**: Sensor arrays reading distance, acceleration, and optical wheel encoders.
2. **Cognition & Control Layer**: Closed-loop PID algorithms calculating motor actuation outputs.
3. **Actuation Layer**: Dual H-Bridge motor drivers (L298N, BTS7960) driving DC encoders or stepper motors.`,
            keyTakeaways: [
              'Understand the tri-layer robotics architecture (Perception -> Control -> Actuation).',
              'Learn sensor fusion techniques for noise reduction in IMU and wheel encoders.',
              'Implement fail-safe emergency stop protocols on hardware loop interrupt pins.'
            ],
            codeSnippet: `// Robot PID Controller Loop in Embedded C++
float Kp = 2.5, Ki = 0.1, Kd = 0.8;
float previousError = 0, integral = 0;

float calculatePID(float setpoint, float currentPV, float dt) {
    float error = setpoint - currentPV;
    integral += error * dt;
    float derivative = (error - previousError) / dt;
    previousError = error;
    return (Kp * error) + (Ki * integral) + (Kd * derivative);
}`
          },
          {
            id: 'les-1-2',
            title: '1.2 Sensor Integration: LiDAR, Ultrasonic & Vision',
            duration: '35m',
            type: 'video',
            videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            content: `In this lesson, we explore how 2D LiDAR scanners broadcast point-cloud data via UART serial packets at 115,200 baud rate. We process sensor arrays to detect obstacles and map local coordinate grids.`,
            keyTakeaways: [
              'Parse NMEA and hex telemetry packets from serial LiDAR streams.',
              'Apply Kalman filtering to smooth noisy ultrasonic distance measurements.',
              'Calculate real-time obstacle vectors relative to robot chassis center.'
            ]
          },
          {
            id: 'les-1-3',
            title: '1.3 Hands-On Lab: Simulated Autonomous Obstacle Avoidance',
            duration: '30m',
            type: 'lab',
            content: `Launch the interactive 3D STEM Simulator to test your obstacle avoidance algorithm on virtual robot chassis with configurable speed and sensor ranges.`,
            keyTakeaways: [
              'Test differential drive velocity vector outputs under dynamic obstacles.',
              'Optimize sensor polling rate without blocking main control loops.'
            ]
          }
        ]
      },
      {
        id: 'mod-2',
        title: 'Module 2: Closed-Loop Motor Control & PID Tuning',
        duration: '1h 45m',
        lessons: [
          {
            id: 'les-2-1',
            title: '2.1 Encoders & Pulse Counting Techniques',
            duration: '30m',
            type: 'article',
            content: `Optical quadrature encoders output two phase-shifted square waves (Phase A and Phase B). By reading rising/falling edge interrupts, the microcontroller determines both velocity and direction of rotation.`,
            keyTakeaways: [
              'Calculate RPM from quadrature encoder pulse counts per revolution (PPR).',
              'Use hardware timer interrupts for high-frequency pulse capturing.'
            ]
          },
          {
            id: 'les-2-2',
            title: '2.2 Tuning Kp, Ki, Kd Parameters for Smooth Motion',
            duration: '45m',
            type: 'article',
            content: `Learn the Ziegler-Nichols tuning method for adjusting Proportional, Integral, and Derivative gain constants to minimize overshoot and settling time in heavy robotic arms and drive platforms.`,
            keyTakeaways: [
              'Prevent integral windup with anti-windup clamping thresholds.',
              'Eliminate steady-state error without inducing high-frequency oscillation.'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'course-ai-cs-201',
    title: 'AI Machine Learning & Neural Network Foundations',
    category: 'Computer Science',
    level: 'Advanced',
    duration: '8 Hours • 5 Modules',
    description: 'Explore neural network math, backpropagation gradients, computer vision, and transformer model architectures for AI assistant development.',
    instructor: 'AI Research Team',
    rating: 4.95,
    enrolledCount: 2150,
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    modules: [
      {
        id: 'mod-ai-1',
        title: 'Module 1: Vector Math, Tensors & Forward Pass',
        duration: '2h',
        lessons: [
          {
            id: 'les-ai-1-1',
            title: '1.1 Matrix Multiplication & Activation Functions',
            duration: '40m',
            type: 'article',
            content: `Neural networks compute linear transformations Y = W · X + B followed by non-linear activation functions such as ReLU, Sigmoid, and GELU.`,
            keyTakeaways: [
              'Understand matrix dimensions in multi-layer perceptron layers.',
              'Compare ReLU, LeakyReLU, and Softmax activation dynamics.'
            ],
            codeSnippet: `import numpy as np

def dense_layer(inputs, weights, bias):
    # Linear transformation
    z = np.dot(inputs, weights) + bias
    # ReLU Activation
    return np.maximum(0, z)`
          },
          {
            id: 'les-ai-1-2',
            title: '1.2 Backpropagation & Gradient Descent',
            duration: '50m',
            type: 'article',
            content: `Gradient descent computes partial derivatives of the loss function with respect to weights using the chain rule, updating parameters theta = theta - alpha * grad(Loss).`,
            keyTakeaways: [
              'Derive partial derivatives through loss functions.',
              'Implement Adam optimizer with momentum and RMSprop scaling.'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'course-physics-301',
    title: 'Applied Physics, Kinematics & Circuit Electrodynamics',
    category: 'Physics',
    level: 'Beginner',
    duration: '5 Hours • 3 Modules',
    description: 'Master Newton kinematics, rotational dynamics, Kirchhoff laws, AC/DC circuit analysis, and electromagnetic fields through interactive simulations.',
    instructor: 'Sai Elite Faculty',
    rating: 4.85,
    enrolledCount: 980,
    coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
    modules: [
      {
        id: 'mod-phy-1',
        title: 'Module 1: Kinematics & Angular Momentum',
        duration: '1h 30m',
        lessons: [
          {
            id: 'les-phy-1-1',
            title: '1.1 Projectile Motion & Vector Velocity Decomposition',
            duration: '35m',
            type: 'article',
            content: `Analyze two-dimensional particle trajectories under constant gravitational acceleration g = 9.81 m/s². Decompose initial velocity v₀ into horizontal vx = v₀ cos(θ) and vertical vy = v₀ sin(θ) components.`,
            keyTakeaways: [
              'Calculate maximum projectile height H = (v₀² sin²θ) / 2g.',
              'Calculate horizontal range R = (v₀² sin 2θ) / g.'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'course-math-401',
    title: 'Engineering Mathematics & Differential Equations',
    category: 'Mathematics',
    level: 'Intermediate',
    duration: '7 Hours • 4 Modules',
    description: 'Comprehensive calculus, Laplace transforms, Fourier series analysis, and linear algebra applications for engineering design.',
    instructor: 'Department of Mathematics',
    rating: 4.9,
    enrolledCount: 1640,
    coverImage: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80',
    modules: [
      {
        id: 'mod-math-1',
        title: 'Module 1: First & Second Order Differential Equations',
        duration: '2h',
        lessons: [
          {
            id: 'les-math-1-1',
            title: '1.1 Ordinary Differential Equations (ODEs) in Control Systems',
            duration: '45m',
            type: 'article',
            content: `Model physical spring-mass-damper and RLC systems using second-order linear differential equations a(d²y/dt²) + b(dy/dt) + cy = f(t).`,
            keyTakeaways: [
              'Solve homogeneous differential equations using characteristic polynomial roots.',
              'Identify underdamped, critically damped, and overdamped system responses.'
            ]
          }
        ]
      }
    ]
  }
];
