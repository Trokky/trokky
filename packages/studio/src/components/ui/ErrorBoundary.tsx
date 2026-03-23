import React, { Component, ReactNode } from 'react';
import { Button } from './Button';
import { DocumentDuplicateIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useT } from 'trokky/i18n';

// Translation strings interface
interface ErrorBoundaryTranslations {
  title: string;
  subtitle: string;
  description: string;
  errorMessage: string;
  stackTrace: string;
  componentStack: string;
  environmentDetails: string;
  noStackTrace: string;
  noComponentStack: string;
  url: string;
  timestamp: string;
  userAgent: string;
  viewport: string;
  tryAgain: string;
  refreshPage: string;
  copyErrorDetails: string;
  copied: string;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  translations?: ErrorBoundaryTranslations;
}

// Default English translations (fallback if i18n not available)
const defaultTranslations: ErrorBoundaryTranslations = {
  title: 'Something went wrong',
  subtitle: 'The application encountered an unexpected error',
  description: 'Please try refreshing the page or contact support if the problem persists. You can copy the error details below to help with troubleshooting.',
  errorMessage: 'Error Message:',
  stackTrace: 'Stack Trace',
  componentStack: 'Component Stack',
  environmentDetails: 'Environment Details',
  noStackTrace: 'No stack trace available',
  noComponentStack: 'No component stack available',
  url: 'URL:',
  timestamp: 'Timestamp:',
  userAgent: 'User Agent:',
  viewport: 'Viewport:',
  tryAgain: 'Try again',
  refreshPage: 'Refresh page',
  copyErrorDetails: 'Copy Error Details',
  copied: 'Copied!'
};

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, copied: false });
  };

  handleCopyError = async () => {
    if (!this.state.error) return;
    
    const errorDetails = this.getErrorDetails();
    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  getErrorDetails = () => {
    const { error, errorInfo } = this.state;
    if (!error) return '';
    
    const timestamp = new Date().toISOString();
    const userAgent = navigator.userAgent;
    const url = window.location.href;
    
    return `Trokky Studio Error Report
Timestamp: ${timestamp}
URL: ${url}
User Agent: ${userAgent}

Error Message:
${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}

Additional Details:
- Error Name: ${error.name}
- Browser: ${navigator.userAgent}
- Viewport: ${window.innerWidth}x${window.innerHeight}
- Timestamp: ${timestamp}`;
  };

  render() {
    const t = this.props.translations || defaultTranslations;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t.description}
                </p>

                {this.state.error && (
                  <div className="space-y-3">
                    {/* Error Message */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        {t.errorMessage}
                      </h4>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                        <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                          {this.state.error.name}: {this.state.error.message}
                        </p>
                      </div>
                    </div>

                    {/* Stack Trace */}
                    <details className="group">
                      <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white flex items-center">
                        <span>{t.stackTrace}</span>
                        <svg className="w-4 h-4 ml-1 group-open:rotate-90 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </summary>
                      <div className="mt-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-auto max-h-40">
                          {this.state.error.stack || t.noStackTrace}
                        </pre>
                      </div>
                    </details>

                    {/* Component Stack */}
                    {this.state.errorInfo?.componentStack && (
                      <details className="group">
                        <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white flex items-center">
                          <span>{t.componentStack}</span>
                          <svg className="w-4 h-4 ml-1 group-open:rotate-90 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </summary>
                        <div className="mt-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                          <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-auto max-h-40">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      </details>
                    )}

                    {/* Environment Info */}
                    <details className="group">
                      <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white flex items-center">
                        <span>{t.environmentDetails}</span>
                        <svg className="w-4 h-4 ml-1 group-open:rotate-90 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </summary>
                      <div className="mt-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <div className="text-xs text-gray-800 dark:text-gray-200 space-y-1">
                          <div><strong>{t.url}</strong> {window.location.href}</div>
                          <div><strong>{t.timestamp}</strong> {new Date().toISOString()}</div>
                          <div><strong>{t.userAgent}</strong> {navigator.userAgent}</div>
                          <div><strong>{t.viewport}</strong> {window.innerWidth}x{window.innerHeight}</div>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
              <Button onClick={this.handleReset} size="sm">
                {t.tryAgain}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                {t.refreshPage}
              </Button>
              {this.state.error && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleCopyError}
                  className="ml-auto"
                >
                  <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                  {this.state.copied ? t.copied : t.copyErrorDetails}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide i18n translations
export function TranslatedErrorBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { t } = useT('studio');

  const translations: ErrorBoundaryTranslations = {
    title: t('errorBoundary.title'),
    subtitle: t('errorBoundary.subtitle'),
    description: t('errorBoundary.description'),
    errorMessage: t('errorBoundary.errorMessage'),
    stackTrace: t('errorBoundary.stackTrace'),
    componentStack: t('errorBoundary.componentStack'),
    environmentDetails: t('errorBoundary.environmentDetails'),
    noStackTrace: t('errorBoundary.noStackTrace'),
    noComponentStack: t('errorBoundary.noComponentStack'),
    url: t('errorBoundary.url'),
    timestamp: t('errorBoundary.timestamp'),
    userAgent: t('errorBoundary.userAgent'),
    viewport: t('errorBoundary.viewport'),
    tryAgain: t('common.tryAgain'),
    refreshPage: t('common.refreshPage'),
    copyErrorDetails: t('common.copyErrorDetails'),
    copied: t('common.copied')
  };

  return (
    <ErrorBoundary translations={translations} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}