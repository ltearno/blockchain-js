import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AppComponent } from './app.component'
import { SupplyChainComponent } from './supply-chain/supply-chain.component'
import { GroupWorkSummaryComponent } from './supply-chain/group-work-summary.component'
import { State } from './supply-chain/state'
import { ArtWorkEditionComponent } from './supply-chain/art-work-edition.component'

@NgModule({
  declarations: [
    AppComponent,
    SupplyChainComponent,
    GroupWorkSummaryComponent,
    ArtWorkEditionComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [
    State
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
