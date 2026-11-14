import copy
import pathlib
import sys
import unittest

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from build_person_life_timeline import inputs, validate, make_rows

class PersonLifeTimelineTest(unittest.TestCase):
    def setUp(self):
        self.data,self.people,self.bundles=inputs()

    def test_wrong_person_id_and_unselected_roster_cannot_enter_handoff(self):
        bad=copy.deepcopy(self.data);bad['events'][0]['personId']='some-other-person'
        with self.assertRaises(AssertionError):validate(bad,self.people,self.bundles)
        bad=copy.deepcopy(self.data);bad['events'][0]['rosterId']='not-selected'
        with self.assertRaises(KeyError):validate(bad,self.people,self.bundles)

    def test_search_snippet_or_wrong_generation_is_not_evidence(self):
        bad=copy.deepcopy(self.bundles);bad['20261029-02']['sources']['hino']['access']='search_snippet_only'
        with self.assertRaises(AssertionError):validate(self.data,self.people,bad)
        bad=copy.deepcopy(self.bundles);bad['20261029-02']['people']['680']['bodyForSelectedPerson']=False
        with self.assertRaises(AssertionError):validate(self.data,self.people,bad)

    def test_unknown_dates_remain_blank_and_output_order_does_not_change_ids(self):
        rows=make_rows(self.data,self.bundles)
        unknown=[r for r in rows if r['年代精度']=='unknown']
        self.assertTrue(unknown)
        self.assertTrue(all(r['開始年・下限'] is None and r['終了年・上限'] is None for r in unknown))
        shuffled=copy.deepcopy(self.data);shuffled['events'].reverse()
        self.assertEqual(rows,make_rows(shuffled,self.bundles))

    def test_excluded_birth_grave_and_bodaiji_relationships_are_rejected(self):
        for rel in ['生誕地','墓所','菩提寺']:
            bad=copy.deepcopy(self.data);bad['events'][0]['relationTypes']=[rel]
            with self.assertRaises(AssertionError):validate(bad,self.people,self.bundles)

    def test_handoff_does_not_silently_publish_coordinates_or_duplicate_events(self):
        summary=validate(self.data,self.people,self.bundles)
        self.assertEqual(summary['selected'],624)
        self.assertEqual(summary['publishedSites'],0)
        self.assertEqual(summary['completeLifeTimelines'],0)
        bad=copy.deepcopy(self.data);bad['events'].append(bad['events'][0])
        with self.assertRaises(AssertionError):validate(bad,self.people,self.bundles)
        bad=copy.deepcopy(self.data);next(iter(bad['candidates'].values()))['coordinates']=[135,35]
        with self.assertRaises(AssertionError):validate(bad,self.people,self.bundles)

if __name__=='__main__':unittest.main()
