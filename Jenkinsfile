pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'docker.io'
        SONAR_HOST_URL = 'http://sonarqube:9000'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            parallel {
                stage('Auth Service') {
                    steps {
                        dir('services/auth-service') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('User Service') {
                    steps {
                        dir('services/user-service') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Trip Service') {
                    steps {
                        dir('services/trip-service') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Payment Service') {
                    steps {
                        dir('services/payment-service') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('API Gateway') {
                    steps {
                        dir('services/api-gateway') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }
        
        stage('Run Tests') {
            parallel {
                stage('Auth Service Tests') {
                    steps {
                        dir('services/auth-service') {
                            sh 'npm test'
                        }
                    }
                }
                stage('User Service Tests') {
                    steps {
                        dir('services/user-service') {
                            sh 'npm test'
                        }
                    }
                }
                stage('Trip Service Tests') {
                    steps {
                        dir('services/trip-service') {
                            sh 'npm test'
                        }
                    }
                }
                stage('Payment Service Tests') {
                    steps {
                        dir('services/payment-service') {
                            sh 'npm test'
                        }
                    }
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Build Docker Images') {
            parallel {
                stage('Auth Service Image') {
                    steps {
                        dir('services/auth-service') {
                            sh 'docker build -t voyago-auth-service:${BUILD_NUMBER} .'
                        }
                    }
                }
                stage('User Service Image') {
                    steps {
                        dir('services/user-service') {
                            sh 'docker build -t voyago-user-service:${BUILD_NUMBER} .'
                        }
                    }
                }
                stage('Trip Service Image') {
                    steps {
                        dir('services/trip-service') {
                            sh 'docker build -t voyago-trip-service:${BUILD_NUMBER} .'
                        }
                    }
                }
                stage('Payment Service Image') {
                    steps {
                        dir('services/payment-service') {
                            sh 'docker build -t voyago-payment-service:${BUILD_NUMBER} .'
                        }
                    }
                }
                stage('API Gateway Image') {
                    steps {
                        dir('services/api-gateway') {
                            sh 'docker build -t voyago-api-gateway:${BUILD_NUMBER} .'
                        }
                    }
                }
                stage('Admin Dashboard Image') {
                    steps {
                        dir('admin-dashboard') {
                            sh 'docker build -t voyago-admin-dashboard:${BUILD_NUMBER} .'
                        }
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh 'ansible-playbook -i ansible/inventory/hosts ansible/deploy.yml'
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
