import {ThemeSettings} from './ThemeSettings';
import {PermissionsPanel} from './PermissionsPanel';
import {AccountIdentity} from '../../auth/Auth';
import {AccountProfilePanel} from './AccountProfilePanel';
export function AccountPage({app}:{app:any}){
 return <div className="page workspace-page account-page">
  {app.headline('PERSONAL SETTINGS / YOUR ACCOUNT','My account.','Your name. Your profile. Make BREACH yours.')}
  <ThemeSettings/>
  <AccountIdentity/>
  <PermissionsPanel/>
  <AccountProfilePanel/>
 </div>;
}
