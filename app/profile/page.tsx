import { Suspense } from "react";
import ProfileView from "./profile-view";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="loading-state">Loading your profile…</div>}>
      <ProfileView />
    </Suspense>
  );
}
