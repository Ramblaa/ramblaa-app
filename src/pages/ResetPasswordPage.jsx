import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const { resetPassword, isLoading } = useAuth()

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setErrors({ submit: 'Invalid reset link. Please request a new password reset.' })
    }
  }, [token])

  const validateForm = () => {
    const newErrors = {}

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    } else if (!/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      newErrors.password = 'Password must contain at least one letter, one number, and one special character'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return
    if (!token) return

    const result = await resetPassword(token, password)

    if (result.success) {
      setSuccess(true)
    } else {
      setErrors({ submit: result.error })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-ink-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 w-20 h-20 bg-brand-600 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">R</span>
            </div>
            <CardTitle className="text-2xl text-ink-900">
              {success ? 'Password Reset!' : 'Set New Password'}
            </CardTitle>
            <CardDescription className="text-ink-500">
              {success
                ? 'Your password has been updated successfully'
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-ink-600">You can now sign in with your new password.</p>
                <Button onClick={() => navigate('/login')} className="w-full">
                  Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                    {!token && (
                      <Link to="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 block mt-2">
                        Request a new reset link
                      </Link>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-red-300' : ''}
                    disabled={!token}
                    required
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Must be at least 8 characters with a letter, number, and special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={errors.confirmPassword ? 'border-red-300' : ''}
                    disabled={!token}
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !token}>
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    'Reset Password'
                  )}
                </Button>

                <div className="text-center">
                  <Link to="/login" className="text-sm text-brand-600 hover:text-brand-700">
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
