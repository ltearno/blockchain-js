import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AppComponent } from './app.component'
import { SupplyChainComponent } from './supply-chain/supply-chain.component'
import { ArtWorkSummaryComponent } from './supply-chain/art-work-summary.component'
import { State } from './supply-chain/state'
import { ArtWorkEditionComponent } from './supply-chain/art-work-edition.component'
import { ArtWorkDetailComponent } from './supply-chain/art-work-detail.component'
import { ArtWorkIconComponent } from './supply-chain/art-work-icon.component'
import { SupplyChainOverviewComponent } from './supply-chain/supply-chain-overview.component'
import { WallOfFameComponent } from './supply-chain/wall-of-fame.component';

@NgModule({
  declarations: [
    AppComponent,
    SupplyChainComponent,
    ArtWorkSummaryComponent,
    ArtWorkEditionComponent,
    ArtWorkDetailComponent,
    ArtWorkIconComponent,
    SupplyChainOverviewComponent,
    ArtWorkEditionComponent,
    WallOfFameComponent
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
