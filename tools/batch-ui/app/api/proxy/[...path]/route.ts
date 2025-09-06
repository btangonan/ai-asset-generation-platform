/**
 * SECURE API PROXY
 * 
 * Critical security layer that:
 * 1. Hides API keys from client
 * 2. Whitelists allowed paths
 * 3. Enforces request size limits
 * 4. Adds rate limiting
 * 
 * NEVER expose ORCH_API_KEY to the client!
 */

import { NextRequest, NextResponse } from 'next/server';

// Whitelisted paths that can be proxied
const ALLOWED_PATHS = [
  '/batch/images',
  '/batch/videos', 
  '/status',
  '/signed-upload'
];

// Max request body size (10MB)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

// Rate limiting map (simple in-memory for MVP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path, 'POST');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path, 'GET');
}

async function handleProxy(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // 1. Validate environment
    const orchBase = process.env.ORCH_BASE;
    const orchApiKey = process.env.ORCH_API_KEY;

    if (!orchBase || !orchApiKey) {
      console.error('Missing ORCH_BASE or ORCH_API_KEY environment variables');
      return NextResponse.json(
        { 
          type: 'about:blank',
          title: 'Configuration Error',
          status: 500,
          detail: 'Server configuration error. Please contact support.'
        },
        { status: 500 }
      );
    }

    // 2. Construct and validate path
    const targetPath = '/' + pathSegments.join('/');
    const isAllowed = ALLOWED_PATHS.some(allowed => 
      targetPath.startsWith(allowed)
    );

    if (!isAllowed) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: `Path ${targetPath} is not allowed`
        },
        { status: 403 }
      );
    }

    // 3. Simple rate limiting (10 requests per minute per IP)
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const now = Date.now();
    const rateLimit = rateLimitMap.get(clientIp);
    
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= 10) {
          return NextResponse.json(
            {
              type: 'about:blank',
              title: 'Too Many Requests',
              status: 429,
              detail: 'Rate limit exceeded. Please wait before trying again.'
            },
            { status: 429 }
          );
        }
        rateLimit.count++;
      } else {
        // Reset window
        rateLimit.count = 1;
        rateLimit.resetTime = now + 60000; // 1 minute
      }
    } else {
      rateLimitMap.set(clientIp, {
        count: 1,
        resetTime: now + 60000
      });
    }

    // Clean up old entries periodically
    if (rateLimitMap.size > 1000) {
      for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }

    // 4. Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-api-key': orchApiKey,
    };

    // Forward batch hash if present
    const batchHash = request.headers.get('x-batch-hash');
    if (batchHash) {
      headers['x-batch-hash'] = batchHash;
    }

    // 5. Prepare body (with size check)
    let body: string | undefined;
    if (method === 'POST') {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Payload Too Large',
            status: 413,
            detail: `Request body exceeds ${MAX_BODY_SIZE} bytes`
          },
          { status: 413 }
        );
      }
      body = await request.text();
    }

    // 6. Make the proxied request
    const targetUrl = `${orchBase}${targetPath}`;
    console.log(`Proxying ${method} request to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      // Add timeout
      signal: AbortSignal.timeout(120000) // 120 second timeout for image generation
    });

    // 7. Parse response
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, return as-is
      responseData = responseText;
    }

    // 8. Return response with same status
    return NextResponse.json(
      responseData,
      { 
        status: response.status,
        headers: {
          'Cache-Control': 'no-store', // Never cache API responses
        }
      }
    );

  } catch (error) {
    console.error('Proxy error:', error);
    
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Request Timeout',
          status: 504,
          detail: 'The request took too long to complete'
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        debug: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      },
      { status: 500 }
    );
  }
}