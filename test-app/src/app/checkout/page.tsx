'use client'

import { usePostHog } from 'posthog-js/react'

export default function CheckoutPage() {
    const posthog = usePostHog()

    const handleCheckoutStarted = () => {
        // 상품 결제 시도 버튼 클릭
        posthog.capture('checkout_started', {
            product: 'premium_subscription',
            price: 29.99
        })
        alert('결제 단계에 진입했습니다! (PostHog Event Logged)')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">결제(Checkout)</h1>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Premium Subscription</span>
                        <span className="font-bold text-gray-900">$29.99/mo</span>
                    </div>
                    <div className="text-sm text-gray-500 px-2 leading-relaxed">
                        CRO 테스트: 현재 페이지에서 결제를 시작하는 비율(Conversion)과 버튼을 누르지 않고 이탈하는 유저(Drop-off) 데이터를 PostHog로 추적합니다.
                    </div>
                </div>

                <button
                    id="checkout-btn"
                    onClick={handleCheckoutStarted}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-md"
                >
                    안전하게 결제 진행하기
                </button>
            </div>
        </div>
    )
}
