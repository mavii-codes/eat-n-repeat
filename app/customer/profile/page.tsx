'use client';

import { CustomerHeader } from '@/components/customer/CustomerHeader';
import { useState } from 'react';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main St, Coffee City, CC 12345',
    city: 'Coffee City',
    zipCode: '12345',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setIsEditing(false);
    // Save to backend would happen here
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      <CustomerHeader 
        title="Your Profile" 
        subtitle="Manage your account settings and preferences"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Sidebar */}
          <div className="md:col-span-1">
            <div className="rounded-2xl bg-white border border-amber-100/30 p-6 space-y-6">
              {/* Avatar */}
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4">
                  JD
                </div>
                <h2 className="text-xl font-bold text-amber-950">{profileData.name}</h2>
                <p className="text-sm text-amber-700 mt-1">{profileData.email}</p>
              </div>

              {/* Quick Stats */}
              <div className="border-t border-amber-100/30 pt-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-700">42</p>
                    <p className="text-xs text-amber-900/60">Total Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-700">$287.50</p>
                    <p className="text-xs text-amber-900/60">Total Spent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-700">🥉</p>
                    <p className="text-xs text-amber-900/60">Member Status</p>
                  </div>
                </div>
              </div>

              {/* Loyalty */}
              <div className="border-t border-amber-100/30 pt-6">
                <h3 className="font-bold text-amber-950 mb-3">Loyalty Points</h3>
                <div className="bg-gradient-to-r from-amber-400 to-amber-600 rounded-lg p-4 text-white">
                  <p className="text-2xl font-bold">287</p>
                  <p className="text-xs mt-1 opacity-90">Points available</p>
                </div>
                <p className="text-xs text-amber-900/60 mt-2">13 points until next reward!</p>
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="md:col-span-2">
            <div className="space-y-8">
              {/* Personal Info Section */}
              <div className="rounded-2xl bg-white border border-amber-100/30 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-amber-950">Personal Information</h3>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      isEditing
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-amber-700 text-white hover:bg-amber-800'
                    }`}
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-amber-950 mb-2">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={profileData.name}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:bg-gray-50 disabled:text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-amber-950 mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:bg-gray-50 disabled:text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-amber-950 mb-2">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:bg-gray-50 disabled:text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-amber-950 mb-2">City</label>
                      <input
                        type="text"
                        name="city"
                        value={profileData.city}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:bg-gray-50 disabled:text-gray-700"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-amber-950 mb-2">Address</label>
                      <textarea
                        name="address"
                        value={profileData.address}
                        onChange={handleChange}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:bg-gray-50 disabled:text-gray-700 resize-none"
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition font-semibold"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Preferences */}
              <div className="rounded-2xl bg-white border border-amber-100/30 p-8">
                <h3 className="text-2xl font-bold text-amber-950 mb-6">Preferences</h3>
                <div className="space-y-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="ml-3 text-amber-900">Email me about special offers and promotions</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="ml-3 text-amber-900">Send order notifications</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="ml-3 text-amber-900">Enable push notifications</span>
                  </label>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-8">
                <h3 className="text-2xl font-bold text-red-900 mb-4">Danger Zone</h3>
                <p className="text-red-900/70 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
                <button className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
